import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-edge';

const protectedPaths = ['/admin'];
const publicPaths = ['/admin/login'];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if it's a public path (skip auth check)
    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // Check if it's a protected path
    if (protectedPaths.some((path) => pathname.startsWith(path))) {
        const token = request.cookies.get('quiz-admin-token')?.value;

        if (!token) {
            const loginUrl = new URL('/admin/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        try {
            await verifyToken(token);
            return NextResponse.next();
        } catch {
            // Invalid token, redirect to login
            const loginUrl = new URL('/admin/login', request.url);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('quiz-admin-token');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - API routes (handled separately)
         */
        /*
         * Match all request paths except:
         * - _next (static files, images, data)
         * - favicon.ico (favicon file)
         * - api/socketio (socket endpoint)
         * - api/auth/login (public login)
         */
        '/((?!_next|favicon.ico|api/socketio|api/auth/login).*)',
    ],
};
