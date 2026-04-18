import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

export type LocationRecord = {
    locationId: string;
    name: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    priceRange: string;
    openingHours: string;
    tips: string;
    description: string;
    embedding: number[];
    imageUrl?: string;
    rating?: number;
    updatedAt?: string;
};

export async function upsertLocations(records: LocationRecord[]) {
    if (records.length === 0) {
        return { upserted: 0 };
    }

    const adminDb = getAdminDb();
    const chunkSize = 400;
    let upserted = 0;

    for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const batch = adminDb.batch();

        chunk.forEach((record) => {
            const ref = adminDb.collection('dalat_locations').doc(record.locationId);
            const imageUrl = record.imageUrl?.trim();
            batch.set(
                ref,
                {
                    locationId: record.locationId,
                    name: record.name,
                    category: record.category,
                    address: record.address,
                    lat: record.lat,
                    lng: record.lng,
                    priceRange: record.priceRange,
                    openingHours: record.openingHours,
                    tips: record.tips,
                    description: record.description,
                    embedding: record.embedding,
                    ...(imageUrl ? { imageUrl } : {}),
                    ...(typeof record.rating === 'number' ? { rating: record.rating } : {}),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        });

        await batch.commit();
        upserted += chunk.length;
    }

    return { upserted };
}
