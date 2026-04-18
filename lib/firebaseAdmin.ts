import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type FirebaseAdminBundle = {
    app: App;
};

declare global {
    // eslint-disable-next-line no-var
    var __firebaseAdminBundle__: FirebaseAdminBundle | undefined;
}

function getPrivateKey() {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('Missing FIREBASE_PRIVATE_KEY');
    }

    return privateKey.replace(/\\n/g, '\n');
}

function createFirebaseAdminApp() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId) {
        throw new Error('Missing FIREBASE_PROJECT_ID');
    }

    if (!clientEmail) {
        throw new Error('Missing FIREBASE_CLIENT_EMAIL');
    }

    if (getApps().length > 0) {
        return getApps()[0]!;
    }

    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey: getPrivateKey(),
        }),
    });
}

function getBundle() {
    if (!global.__firebaseAdminBundle__) {
        global.__firebaseAdminBundle__ = {
            app: createFirebaseAdminApp(),
        };
    }

    return global.__firebaseAdminBundle__;
}

export function getAdminApp() {
    return getBundle().app;
}

export function getAdminAuth() {
    return getAuth(getAdminApp());
}

export function getAdminDb() {
    return getFirestore(getAdminApp());
}
