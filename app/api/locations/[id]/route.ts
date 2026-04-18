import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/http';
import { getLocationDocById } from '@/lib/repos/locationsRepo';
import { getSeedLocationById } from '@/lib/seedLocations';

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
        const { id } = await context.params;

        if (!id) {
            return fail('Missing location id in route params.', 400);
        }

        const location = await getLocationDocById(id);

        if (location) {
            return ok({
                location: {
                    locationId: location.doc.id,
                    ...(location.doc.data() ?? {}),
                },
            });
        }

        const seedLocation = await getSeedLocationById(id);

        if (!seedLocation) {
            return fail('Location not found.', 404);
        }

        return ok({ location: seedLocation });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/locations/[id] [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}