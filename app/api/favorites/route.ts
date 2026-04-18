import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';
import { getLocationsByIds } from '@/lib/repos/locationsRepo';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value: string | null) {
    if (!value) {
        return DEFAULT_LIMIT;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_LIMIT;
    }

    return Math.min(parsed, MAX_LIMIT);
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function timestampToMillis(value: unknown) {
    if (!value || typeof value !== 'object') {
        return 0;
    }

    const raw = value as Record<string, unknown>;
    const seconds = raw._seconds;
    const nanoseconds = raw._nanoseconds;

    if (typeof seconds === 'number' && typeof nanoseconds === 'number') {
        return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    }

    return 0;
}

type FavoriteRecord = {
    id: string;
    userId: string;
    placeId: string;
    createdAt?: unknown;
};

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
        const adminDb = getAdminDb();

        const snapshot = await adminDb
            .collection('user_favorites')
            .where('userId', '==', auth.uid)
            .limit(limit)
            .get();

        const favorites: FavoriteRecord[] = snapshot.docs
            .map((doc) => {
                const data = doc.data() ?? {};
                const placeId = typeof data.placeId === 'string' ? data.placeId.trim() : '';

                return {
                    id: doc.id,
                    userId: typeof data.userId === 'string' ? data.userId : auth.uid,
                    placeId,
                    createdAt: data.createdAt,
                };
            })
            .filter((item) => item.placeId.length > 0);

        const placesById = await getLocationsByIds(favorites.map((favorite) => favorite.placeId));

        const result = favorites
            .map((favorite) => ({
                ...favorite,
                place: placesById.get(favorite.placeId) ?? null,
            }))
            .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));

        return ok({ favorites: result });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/favorites [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
