import { NextResponse } from 'next/server';

export function ok<T>(data: T, init?: ResponseInit) {
    return NextResponse.json(
        {
            success: true,
            data,
        },
        {
            status: init?.status ?? 200,
            headers: init?.headers,
        },
    );
}

export function fail(message: string, status = 400, details?: unknown) {
    return NextResponse.json(
        {
            success: false,
            error: {
                message,
                details: details ?? null,
            },
        },
        { status },
    );
}
