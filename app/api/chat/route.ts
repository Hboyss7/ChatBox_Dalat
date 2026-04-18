import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getChatModel } from '@/lib/gemini';
import { fail, ok } from '@/lib/http';
import { buildChatPrompt } from '@/lib/prompt';
import { type RetrievedLocation, retrieveTopLocationsByQuery } from '@/lib/retrieval';

const chatRequestSchema = z.object({
    threadId: z.string().min(1).max(120).optional(),
    message: z.string().min(1).max(2000),
});

type StoredMessage = {
    role?: 'user' | 'assistant' | 'system';
    content?: string;
    createdAt?: unknown;
};

type ChatSource = {
    id: string;
    locationId: string;
    name: string;
    imageUrl: string | null;
    rating: number | null;
    address: string;
    score: number;
};

function normalizeSourceImageUrl(location: RetrievedLocation) {
    const imageCandidates = [location.imageUrl, location.image];

    for (const candidate of imageCandidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return null;
}

function normalizeSourceRating(rawRating: unknown) {
    let ratingValue: number | null = null;

    if (typeof rawRating === 'number' && Number.isFinite(rawRating)) {
        ratingValue = rawRating;
    }

    if (typeof rawRating === 'string' && rawRating.trim().length > 0) {
        const parsed = Number(rawRating);

        if (Number.isFinite(parsed)) {
            ratingValue = parsed;
        }
    }

    if (ratingValue === null) {
        return null;
    }

    const clamped = Math.max(0, Math.min(5, ratingValue));
    return Number(clamped.toFixed(1));
}

function mapContextToSource(location: RetrievedLocation): ChatSource {
    return {
        id: location.locationId,
        locationId: location.locationId,
        name: location.name,
        imageUrl: normalizeSourceImageUrl(location),
        rating: normalizeSourceRating(location.rating),
        address: location.address,
        score: Number(location.score.toFixed(4)),
    };
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

async function ensureThreadBelongsToUser(threadId: string, uid: string) {
    const adminDb = getAdminDb();
    const threadRef = adminDb.collection('chat_threads').doc(threadId);
    const snapshot = await threadRef.get();

    if (!snapshot.exists) {
        return { threadRef, exists: false, error: fail('Thread not found.', 404) };
    }

    const threadData = snapshot.data();

    if (threadData?.uid !== uid) {
        return {
            threadRef,
            exists: true,
            error: fail('Forbidden: thread does not belong to current user.', 403),
        };
    }

    return { threadRef, exists: true, error: null };
}

async function readRecentHistory(threadId: string, limit = 8) {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
        .collection('chat_messages')
        .where('threadId', '==', threadId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

    const messages = snapshot.docs
        .map((doc) => doc.data() as StoredMessage)
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .map((item) => ({
            role: item.role as 'user' | 'assistant',
            content: item.content ?? '',
        }))
        .filter((item) => item.content.trim().length > 0)
        .reverse();

    return messages;
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const rawBody = await request.json().catch(() => ({}));
        const parsed = chatRequestSchema.safeParse(rawBody ?? {});

        if (!parsed.success) {
            return fail('Invalid payload for chat request.', 422, parsed.error.flatten());
        }

        const payload = parsed.data;
        const userMessage = payload.message.trim();
        const adminDb = getAdminDb();

        let threadId = payload.threadId;
        let threadRef = threadId ? adminDb.collection('chat_threads').doc(threadId) : null;

        if (threadId) {
            const checkResult = await ensureThreadBelongsToUser(threadId, auth.uid);

            if (checkResult.error) {
                return checkResult.error;
            }

            threadRef = checkResult.threadRef;
        } else {
            threadRef = adminDb.collection('chat_threads').doc();
            threadId = threadRef.id;

            await threadRef.set({
                threadId,
                uid: auth.uid,
                title: userMessage.slice(0, 60) || 'Cuộc hội thoại mới',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                lastMessageAt: FieldValue.serverTimestamp(),
            });
        }

        const userMessageRef = adminDb.collection('chat_messages').doc();
        await userMessageRef.set({
            messageId: userMessageRef.id,
            threadId,
            uid: auth.uid,
            role: 'user',
            content: userMessage,
            createdAt: FieldValue.serverTimestamp(),
        });

        const contexts = await retrieveTopLocationsByQuery(userMessage, 5);
        const sources = contexts.map((location) => mapContextToSource(location));
        const recentHistory = await readRecentHistory(threadId, 8);
        const prompt = buildChatPrompt({
            userMessage,
            contexts,
            history: recentHistory,
        });

        const model = getChatModel();
        const geminiResult = await model.generateContent(prompt);
        const assistantAnswer = geminiResult.response.text().trim();

        if (!assistantAnswer) {
            throw new Error('Gemini returned empty assistant answer.');
        }

        const assistantMessageRef = adminDb.collection('chat_messages').doc();
        await assistantMessageRef.set({
            messageId: assistantMessageRef.id,
            threadId,
            uid: auth.uid,
            role: 'assistant',
            content: assistantAnswer,
            sources,
            createdAt: FieldValue.serverTimestamp(),
        });

        await threadRef!.set(
            {
                updatedAt: FieldValue.serverTimestamp(),
                lastMessageAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );

        return ok({
            threadId,
            answer: assistantAnswer,
            sources,
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/chat [POST]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
