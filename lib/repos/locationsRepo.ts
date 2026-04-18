import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const LOCATION_COLLECTION_CANDIDATES = ['dalat_locations', 'locations'] as const;
export const PRIMARY_LOCATION_COLLECTION = LOCATION_COLLECTION_CANDIDATES[0];

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

type LocationDocData = {
    locationId?: string;
    [key: string]: unknown;
};

export async function getLocationCollectionWithData(limit: number) {
    const adminDb = getAdminDb();
    let primarySnapshot: FirebaseFirestore.QuerySnapshot | null = null;

    for (const collectionName of LOCATION_COLLECTION_CANDIDATES) {
        const snapshot = await adminDb.collection(collectionName).limit(limit).get();

        if (collectionName === PRIMARY_LOCATION_COLLECTION) {
            primarySnapshot = snapshot;
        }

        if (!snapshot.empty) {
            return {
                collectionName,
                snapshot,
            };
        }
    }

    return {
        collectionName: PRIMARY_LOCATION_COLLECTION,
        snapshot: primarySnapshot ?? await adminDb.collection(PRIMARY_LOCATION_COLLECTION).limit(limit).get(),
    };
}

export async function getLocationDocById(locationId: string) {
    const adminDb = getAdminDb();

    for (const collectionName of LOCATION_COLLECTION_CANDIDATES) {
        const doc = await adminDb.collection(collectionName).doc(locationId).get();

        if (doc.exists) {
            return {
                collectionName,
                doc,
            };
        }
    }

    return null;
}

export async function getLocationsByIds(locationIds: string[]) {
    const adminDb = getAdminDb();
    const uniqueIds = Array.from(new Set(locationIds.map((id) => id.trim()).filter((id) => id.length > 0)));
    const placesById = new Map<string, LocationDocData & { locationId: string }>();

    for (const collectionName of LOCATION_COLLECTION_CANDIDATES) {
        const unresolvedIds = uniqueIds.filter((id) => !placesById.has(id));

        if (unresolvedIds.length === 0) {
            break;
        }

        const snapshots = await Promise.all(
            unresolvedIds.map((id) => adminDb.collection(collectionName).doc(id).get()),
        );

        snapshots.forEach((snapshot) => {
            if (!snapshot.exists) {
                return;
            }

            const data = (snapshot.data() ?? {}) as LocationDocData;

            placesById.set(snapshot.id, {
                ...data,
                locationId: snapshot.id,
            });
        });
    }

    return placesById;
}

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
            const ref = adminDb.collection(PRIMARY_LOCATION_COLLECTION).doc(record.locationId);
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
