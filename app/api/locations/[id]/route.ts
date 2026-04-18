import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/authServer';
import { fail, ok } from '@/lib/http';
import { getLocationDocById } from '@/lib/repos/locationsRepo';

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

        const location = await getLocationDocById(id);

        if (!location) {
            return fail('Location not found.', 404);
        }

        return ok({
            location: {
                locationId: location.doc.id,
                ...(location.doc.data() ?? {}),
            },
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/locations/[id] [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}