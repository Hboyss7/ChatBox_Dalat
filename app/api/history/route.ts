import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

const createThreadSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    firstMessage: z.string().min(1).max(2000).optional(),
});

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

        const adminDb = getAdminDb();
        const snapshot = await adminDb
            .collection('chat_threads')
            .where('uid', '==', auth.uid)
            .orderBy('lastMessageAt', 'desc')
            .limit(50)
            .get();

        const threads = snapshot.docs.map((doc) => ({
            threadId: doc.id,
            ...(doc.data() ?? {}),
        }));

        return ok({ threads });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/history [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const rawBody = await request.json().catch(() => ({}));
        const parsed = createThreadSchema.safeParse(rawBody ?? {});

        if (!parsed.success) {
            return fail('Invalid payload for creating thread.', 422, parsed.error.flatten());
        }

        const payload = parsed.data;
        const adminDb = getAdminDb();

        const threadRef = adminDb.collection('chat_threads').doc();
        const threadId = threadRef.id;
        const initialTitle = payload.title || 'Cuộc hội thoại mới';

        await threadRef.set({
            threadId,
            uid: auth.uid,
            title: initialTitle,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            lastMessageAt: FieldValue.serverTimestamp(),
        });

        if (payload.firstMessage) {
            const messageRef = adminDb.collection('chat_messages').doc();

            await messageRef.set({
                messageId: messageRef.id,
                threadId,
                uid: auth.uid,
                role: 'user',
                content: payload.firstMessage,
                createdAt: FieldValue.serverTimestamp(),
            });

            await threadRef.set(
                {
                    updatedAt: FieldValue.serverTimestamp(),
                    lastMessageAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        }

        return ok({ threadId }, { status: 201 });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/history [POST]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
