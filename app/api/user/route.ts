import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyRequestAuth } from '@/lib/authServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { fail, ok } from '@/lib/http';

const bodySchema = z
    .object({
        displayName: z.string().min(1).max(80).optional(),
        photoURL: z.string().url().optional(),
    })
    .optional();

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
        const userRef = adminDb.collection('users').doc(auth.uid);
        const snapshot = await userRef.get();

        if (!snapshot.exists) {
            const newUser = {
                uid: auth.uid,
                email: auth.email ?? null,
                displayName: null,
                photoURL: null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await userRef.set(newUser);
            const createdSnapshot = await userRef.get();

            return ok({
                uid: auth.uid,
                ...(createdSnapshot.data() ?? {}),
            });
        }

        return ok({
            uid: auth.uid,
            ...(snapshot.data() ?? {}),
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/user [GET]:', error);
        return fail(getErrorMessage(error), 500);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await verifyRequestAuth(request);

        if (!auth) {
            return fail('Unauthorized: missing or invalid bearer token.', 401);
        }

        const rawBody = await request.json();
        const parsed = bodySchema.safeParse(rawBody);

        if (!parsed.success) {
            return fail('Invalid payload for updating profile.', 422, parsed.error.flatten());
        }

        const payload = parsed.data ?? {};

        if (!payload.displayName && !payload.photoURL) {
            return fail('Nothing to update. Provide displayName or photoURL.', 400);
        }

        const adminDb = getAdminDb();
        const userRef = adminDb.collection('users').doc(auth.uid);
        const snapshot = await userRef.get();

        if (!snapshot.exists) {
            await userRef.set({
                uid: auth.uid,
                email: auth.email ?? null,
                displayName: payload.displayName ?? null,
                photoURL: payload.photoURL ?? null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        } else {
            await userRef.set(
                {
                    uid: auth.uid,
                    email: auth.email ?? null,
                    displayName: payload.displayName ?? null,
                    photoURL: payload.photoURL ?? null,
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        }
        const updatedSnapshot = await userRef.get();

        return ok({
            uid: auth.uid,
            ...(updatedSnapshot.data() ?? {}),
        });
    } catch (error: unknown) {
        console.error('[API Error] tại /api/user [PATCH]:', error);
        return fail(getErrorMessage(error), 500);
    }
}
