import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

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

        const { id } = await context.params;

        if (!id) {
            return fail('Missing location id in route params.', 400);
        }

        const adminDb = getAdminDb();
        const locationRef = adminDb.collection('dalat_locations').doc(id);
        const snapshot = await locationRef.get();

        if (!snapshot.exists) {
            return fail('Location not found.', 404);
        }

        return ok({
            location: {
                locationId: snapshot.id,
                ...(snapshot.data() ?? {}),
            },
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/locations/[id] [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}