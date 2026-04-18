import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

const toggleFavoriteSchema = z.object({
    placeId: z.string().min(1).max(160),
});

function buildFavoriteId(userId: string, placeId: string) {
    return `${encodeURIComponent(userId)}__${encodeURIComponent(placeId)}`;
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const rawBody = await request.json().catch(() => ({}));
        const parsed = toggleFavoriteSchema.safeParse(rawBody ?? {});

        if (!parsed.success) {
            return fail('Invalid payload for toggling favorite.', 422, parsed.error.flatten());
        }

        const placeId = parsed.data.placeId.trim();
        const adminDb = getAdminDb();
        const placeRef = adminDb.collection('dalat_locations').doc(placeId);
        const placeSnapshot = await placeRef.get();

        if (!placeSnapshot.exists) {
            return fail('Place not found.', 404);
        }

        const favoriteId = buildFavoriteId(auth.uid, placeId);
        const favoriteRef = adminDb.collection('user_favorites').doc(favoriteId);

        const toggleResult = await adminDb.runTransaction(async (transaction) => {
            const favoriteSnapshot = await transaction.get(favoriteRef);

            if (favoriteSnapshot.exists) {
                transaction.delete(favoriteRef);
                return {
                    action: 'removed' as const,
                    isFavorite: false,
                };
            }

            transaction.set(favoriteRef, {
                id: favoriteId,
                userId: auth.uid,
                placeId,
                createdAt: FieldValue.serverTimestamp(),
            });

            return {
                action: 'added' as const,
                isFavorite: true,
            };
        });

        return ok({
            favoriteId,
            placeId,
            ...toggleResult,
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/favorites/toggle [POST]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
