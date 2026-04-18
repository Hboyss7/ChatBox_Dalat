import { createEmbedding, normalizeEmbeddingText } from '@/lib/embeddings';
import { getLocationCollectionWithData } from '@/lib/repos/locationsRepo';

type LocationDoc = {
    locationId: string;
    name: string;
    category: string;
    address: string;
    lat?: number;
    lng?: number;
    priceRange?: string;
    openingHours?: string;
    tips?: string;
    description?: string;
    imageUrl?: string;
    image?: string;
    rating?: number | string;
    embedding?: number[];
};

export type RetrievedLocation = LocationDoc & {
    score: number;
};

const MAX_LOCATION_SCAN = 300;

function dotProduct(a: number[], b: number[]) {
    const size = Math.min(a.length, b.length);
    let total = 0;

    for (let i = 0; i < size; i += 1) {
        total += a[i]! * b[i]!;
    }

    return total;
}

function vectorNorm(vector: number[]) {
    return Math.sqrt(dotProduct(vector, vector));
}

function cosineSimilarity(a: number[], b: number[]) {
    const denominator = vectorNorm(a) * vectorNorm(b);

    if (!denominator) {
        return 0;
    }

    return dotProduct(a, b) / denominator;
}

function extractKeywords(text: string) {
    return normalizeEmbeddingText(text)
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= 3);
}

function keywordScore(query: string, location: LocationDoc) {
    const keywords = extractKeywords(query);

    if (keywords.length === 0) {
        return 0;
    }

    const searchable = normalizeEmbeddingText(
        [
            location.name,
            location.category,
            location.address,
            location.description ?? '',
            location.tips ?? '',
            location.priceRange ?? '',
            location.openingHours ?? '',
        ].join(' '),
    ).toLowerCase();

    let matched = 0;

    keywords.forEach((keyword) => {
        if (searchable.includes(keyword)) {
            matched += 1;
        }
    });

    return matched / keywords.length;
}

export async function retrieveTopLocationsByQuery(query: string, topK = 5) {
    const queryEmbedding = await createEmbedding(query);
    return retrieveTopLocationsByEmbedding(queryEmbedding, query, topK);
}

export async function retrieveTopLocationsByEmbedding(queryEmbedding: number[], query: string, topK = 5) {
    const { snapshot } = await getLocationCollectionWithData(MAX_LOCATION_SCAN);

    const ranked: RetrievedLocation[] = [];

    snapshot.docs.forEach((doc) => {
        const data = doc.data() as LocationDoc;

        if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
            return;
        }

        const semanticScore = cosineSimilarity(queryEmbedding, data.embedding);
        const lexicalScore = keywordScore(query, data);
        const score = semanticScore * 0.85 + lexicalScore * 0.15;

        ranked.push({
            ...data,
            locationId: data.locationId || doc.id,
            score,
        });
    });

    ranked.sort((a, b) => b.score - a.score);

    return ranked.slice(0, Math.max(1, topK));
}
