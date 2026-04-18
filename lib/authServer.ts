import { type NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export type AuthContext = {
    uid: string;
    email?: string;
};

export function getBearerToken(request: NextRequest) {
    const authorization = request.headers.get('authorization');

    if (!authorization) {
        return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token.trim();
}

export async function verifyRequestAuth(request: NextRequest): Promise<AuthContext | null> {
    const token = getBearerToken(request);

    if (!token) {
        return null;
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);

    return {
        uid: decodedToken.uid,
        email: decodedToken.email,
    };
}
