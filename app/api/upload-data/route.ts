import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyRequestAuth } from '@/lib/authServer';
import { createEmbeddingsBatch, normalizeEmbeddingText } from '@/lib/embeddings';
import { fail, ok } from '@/lib/http';
import { type LocationRecord, upsertLocations } from '@/lib/repos/locationsRepo';

const locationSchema = z.object({
    locationId: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    address: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
    priceRange: z.string().min(1),
    openingHours: z.string().min(1),
    tips: z.string().min(1),
    description: z.string().min(1),
    imageUrl: z.string().url().optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    updatedAt: z.string().optional(),
});

const locationsSchema = z.array(locationSchema).min(1);
const EMBEDDING_BATCH_SIZE = 5;
const BETWEEN_BATCH_DELAY_MS = 1500;

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function buildEmbeddingText(location: z.infer<typeof locationSchema>) {
    return normalizeEmbeddingText([
        location.name,
        location.category,
        location.description,
        location.address,
        `Giá: ${location.priceRange}`,
        `Giờ mở cửa: ${location.openingHours}`,
        `Mẹo: ${location.tips}`,
    ].join('\n'));
}

async function checkUploadPermission(request: NextRequest) {
    const uploadSecret = process.env.UPLOAD_DATA_SECRET?.trim();

    if (uploadSecret) {
        const provided = request.headers.get('x-upload-secret')?.trim();
        return provided === uploadSecret;
    }

    const auth = await verifyRequestAuth(request);
    return Boolean(auth?.uid);
}

export async function POST(request: NextRequest) {
    try {
        const hasPermission = await checkUploadPermission(request);

        if (!hasPermission) {
            return fail('Forbidden: missing upload permission.', 403);
        }

        const jsonPath = path.join(process.cwd(), 'data', 'dalat_locations.json');
        const jsonContent = await readFile(jsonPath, 'utf8');
        const parsedJson = JSON.parse(jsonContent) as unknown;
        const parsed = locationsSchema.safeParse(parsedJson);

        if (!parsed.success) {
            return fail('Invalid dalat_locations.json format.', 422, parsed.error.flatten());
        }

        const locations = parsed.data;
        const records: LocationRecord[] = [];

        for (let i = 0; i < locations.length; i += EMBEDDING_BATCH_SIZE) {
            const chunk = locations.slice(i, i + EMBEDDING_BATCH_SIZE);
            const embeddingTexts = chunk.map((location) => buildEmbeddingText(location));
            const embeddings = await createEmbeddingsBatch(embeddingTexts);

            chunk.forEach((location, index) => {
                records.push({
                    ...location,
                    embedding: embeddings[index],
                });
            });

            if (i + EMBEDDING_BATCH_SIZE < locations.length) {
                await delay(BETWEEN_BATCH_DELAY_MS);
            }
        }

        const result = await upsertLocations(records);

        return ok({
            message: 'Uploaded and embedded dalat locations successfully.',
            count: result.upserted,
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/upload-data [POST]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
