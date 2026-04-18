import { GoogleGenerativeAI } from '@google/generative-ai';

// const CHAT_MODEL = 'gemini-2.5-flash';
const CHAT_MODEL = 'gemini-3.1-flash-lite-preview';
const EMBEDDING_MODEL = 'gemini-embedding-001';

type GeminiBundle = {
    client: GoogleGenerativeAI;
};

declare global {
    // eslint-disable-next-line no-var
    var __geminiBundle__: GeminiBundle | undefined;
}

function getApiKey() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY');
    }

    return apiKey;
}

function getBundle() {
    if (!global.__geminiBundle__) {
        global.__geminiBundle__ = {
            client: new GoogleGenerativeAI(getApiKey()),
        };
    }

    return global.__geminiBundle__;
}

export function getGeminiClient() {
    return getBundle().client;
}

export function getChatModel() {
    return getGeminiClient().getGenerativeModel({ model: CHAT_MODEL });
}

export function getEmbeddingModel() {
    return getGeminiClient().getGenerativeModel({ model: EMBEDDING_MODEL });
}

export const GEMINI_CHAT_MODEL_NAME = CHAT_MODEL;
export const GEMINI_EMBEDDING_MODEL_NAME = EMBEDDING_MODEL;
