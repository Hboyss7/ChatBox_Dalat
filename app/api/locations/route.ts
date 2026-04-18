import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

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

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
        const adminDb = getAdminDb();
        const snapshot = await adminDb.collection('dalat_locations').limit(limit).get();

        const locations = snapshot.docs.map((doc) => ({
            locationId: doc.id,
            ...(doc.data() ?? {}),
        }));

        return ok({ locations });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/locations [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}