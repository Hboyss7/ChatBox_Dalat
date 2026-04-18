import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

type RouteContext = {
    params: Promise<{
        placeId: string;
    }>;
};

function buildFavoriteId(userId: string, placeId: string) {
    return `${encodeURIComponent(userId)}__${encodeURIComponent(placeId)}`;
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const { placeId: rawPlaceId } = await context.params;
        const placeId = typeof rawPlaceId === 'string' ? rawPlaceId.trim() : '';

        if (!placeId) {
            return fail('Missing placeId in route params.', 400);
        }

        const adminDb = getAdminDb();
        const favoriteId = buildFavoriteId(auth.uid, placeId);
        const favoriteRef = adminDb.collection('user_favorites').doc(favoriteId);
        const favoriteSnapshot = await favoriteRef.get();

        return ok({
            placeId,
            isFavorite: favoriteSnapshot.exists,
            favoriteId: favoriteSnapshot.exists ? favoriteId : null,
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/favorites/check/[placeId] [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
