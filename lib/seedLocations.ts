import { readFile } from 'node:fs/promises';
import path from 'node:path';

type SeedLocation = {
    locationId: string;
    [key: string]: unknown;
};

let seedLocationsCache: SeedLocation[] | null = null;

function toSeedLocation(value: unknown, index: number): SeedLocation {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const rawLocationId = record.locationId;
    const locationId = typeof rawLocationId === 'string' && rawLocationId.trim().length > 0
        ? rawLocationId.trim()
        : `seed-${index}`;

    return {
        ...record,
        locationId,
    };
}

export async function getSeedLocations() {
    if (seedLocationsCache) {
        return seedLocationsCache;
    }

    const jsonPath = path.join(process.cwd(), 'data', 'dalat_locations.json');
    const jsonContent = await readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(jsonContent) as unknown;

    if (!Array.isArray(parsed)) {
        seedLocationsCache = [];
        return seedLocationsCache;
    }

    seedLocationsCache = parsed.map((item, index) => toSeedLocation(item, index));
    return seedLocationsCache;
}

export async function getSeedLocationById(locationId: string) {
    const seedLocations = await getSeedLocations();
    return seedLocations.find((location) => location.locationId === locationId) ?? null;
}
