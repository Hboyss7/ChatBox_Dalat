import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version, x-upload-secret',
    'Access-Control-Max-Age': '86400',
};

function applyCorsHeaders(response: NextResponse) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
}

export function middleware(request: NextRequest) {
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 204 });
        applyCorsHeaders(response);
        return response;
    }

    const response = NextResponse.next();
    applyCorsHeaders(response);
    return response;
}

export const config = {
    matcher: ['/api/:path*'],
};
