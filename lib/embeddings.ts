import { getEmbeddingModel } from '@/lib/gemini';

const MAX_EMBEDDING_INPUT_LENGTH = 8000;
const EMBEDDING_MAX_RETRIES = 4;
const EMBEDDING_BACKOFF_BASE_MS = 2500;

export function normalizeEmbeddingText(input: string) {
    return input
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_EMBEDDING_INPUT_LENGTH);
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isRateLimitError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('429') || message.toLowerCase().includes('too many requests');
}

export async function createEmbedding(input: string) {
    const text = normalizeEmbeddingText(input);

    if (!text) {
        throw new Error('Cannot create embedding from empty text.');
    }

    const model = getEmbeddingModel();
    const result = await model.embedContent(text);
    const values = result.embedding?.values;

    if (!values || values.length === 0) {
        throw new Error('Gemini embedding response does not contain vector values.');
    }

    return values;
}

export async function createEmbeddingsBatch(inputs: string[]) {
    if (inputs.length === 0) {
        return [] as number[][];
    }

    const normalizedInputs = inputs.map((input) => normalizeEmbeddingText(input));

    if (normalizedInputs.some((input) => !input)) {
        throw new Error('Cannot create embedding from empty text.');
    }

    const model = getEmbeddingModel();

    for (let attempt = 0; attempt <= EMBEDDING_MAX_RETRIES; attempt += 1) {
        try {
            const result = await model.batchEmbedContents({
                requests: normalizedInputs.map((text) => ({
                    content: {
                        role: 'user',
                        parts: [{ text }],
                    },
                })),
            });

            const embeddings = result.embeddings ?? [];

            if (embeddings.length !== normalizedInputs.length) {
                throw new Error('Gemini batch embedding response length mismatch.');
            }

            return embeddings.map((embedding, index) => {
                const values = embedding.values;

                if (!values || values.length === 0) {
                    throw new Error(
                        `Gemini batch embedding response is missing vector values at index ${index}.`,
                    );
                }

                return values;
            });
        } catch (error: unknown) {
            const canRetry = isRateLimitError(error) && attempt < EMBEDDING_MAX_RETRIES;

            if (!canRetry) {
                throw error;
            }

            const backoffMs = EMBEDDING_BACKOFF_BASE_MS * 2 ** attempt;
            await delay(backoffMs);
        }
    }

    throw new Error('Failed to create batch embeddings after retry attempts.');
}
