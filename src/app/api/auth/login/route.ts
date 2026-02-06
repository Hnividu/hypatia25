import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

// Route segment config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Get credentials from environment or use defaults
        const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
        const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

        // Simple credential check
        const isValid = username === expectedUsername && password === expectedPassword;

        console.log('Login attempt:', {
            username,
            // Don't log expectedUsername/passwords
            success: isValid
        });

        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Create JWT token
        const token = await createToken(username);

        // Create response with cookie
        const response = NextResponse.json({
            success: true,
            message: 'Login successful',
        });

        // Set the auth cookie on the response
        response.cookies.set('quiz-admin-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
