import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

type RouteContext = {
    params: Promise<{
        threadId: string;
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

        const { threadId } = await context.params;

        if (!threadId) {
            return fail('Missing threadId in route params.', 400);
        }

        const adminDb = getAdminDb();
        const threadRef = adminDb.collection('chat_threads').doc(threadId);
        const threadSnapshot = await threadRef.get();

        if (!threadSnapshot.exists) {
            return fail('Thread not found.', 404);
        }

        const thread = threadSnapshot.data();

        if (thread?.uid !== auth.uid) {
            return fail('Forbidden: thread does not belong to current user.', 403);
        }

        const messagesSnapshot = await adminDb
            .collection('chat_messages')
            .where('threadId', '==', threadId)
            .orderBy('createdAt', 'asc')
            .limit(500)
            .get();

        const messages = messagesSnapshot.docs.map((doc) => ({
            messageId: doc.id,
            ...(doc.data() ?? {}),
        }));

        return ok({
            thread: {
                threadId,
                ...(thread ?? {}),
            },
            messages,
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/history/[threadId] [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const { threadId } = await context.params;

        if (!threadId) {
            return fail('Missing threadId in route params.', 400);
        }

        const adminDb = getAdminDb();
        const threadRef = adminDb.collection('chat_threads').doc(threadId);
        const threadSnapshot = await threadRef.get();

        if (!threadSnapshot.exists) {
            return fail('Thread not found.', 404);
        }

        const thread = threadSnapshot.data();

        if (thread?.uid !== auth.uid) {
            return fail('Forbidden: thread does not belong to current user.', 403);
        }

        const pageSize = 200;
        let deletedMessages = 0;

        while (true) {
            const messagesSnapshot = await adminDb
                .collection('chat_messages')
                .where('threadId', '==', threadId)
                .limit(pageSize)
                .get();

            if (messagesSnapshot.empty) {
                break;
            }

            const batch = adminDb.batch();

            messagesSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deletedMessages += messagesSnapshot.size;

            if (messagesSnapshot.size < pageSize) {
                break;
            }
        }

        await threadRef.delete();

        return ok({
            threadId,
            deletedMessages,
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/history/[threadId] [DELETE]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
