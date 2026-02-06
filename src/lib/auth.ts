import bcrypt from 'bcryptjs';
// import { SignJWT, jwtVerify } from 'jose'; // Moved to auth-edge.ts
import { cookies } from 'next/headers';

// JWT_SECRET moved to auth-edge.ts for creating tokens.
// However, we might need it for signing? createToken handles signing in auth-edge.
// So we don't need it here unless we have other uses. We don't.
// But wait, the original code had a warning block. I should remove it too.

const COOKIE_NAME = 'quiz-admin-token';
// const TOKEN_EXPIRY = '7d'; // Moved to auth-edge.ts

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hash a password for storage
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────

interface AdminCredentials {
    username: string;
    password: string;
}

/**
 * Get admin credentials from environment
 * Uses plain password for simplicity - in production, consider using a database
 */
function getAdminCredentials(): AdminCredentials {
    return {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
    };
}

/**
 * Validate admin credentials
 */
export async function validateAdminCredentials(
    username: string,
    password: string
): Promise<boolean> {
    const admin = getAdminCredentials();

    if (username !== admin.username) {
        return false;
    }

    // Simple password comparison
    return password === admin.password;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT TOKEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

import { createToken, verifyToken } from './auth-edge';
export { createToken, verifyToken };
export type { TokenPayload } from './auth-edge';

// Logic moved to auth-edge.ts for middleware compatibility.

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the auth cookie
 */
export async function setAuthCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}

/**
 * Get the auth token from cookies
 */
export async function getAuthToken(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Clear the auth cookie (logout)
 */
export async function clearAuthCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const token = await getAuthToken();
    if (!token) return false;

    const payload = await verifyToken(token);
    return payload !== null;
}

/**
 * Get the current admin username
 */
export async function getCurrentAdmin(): Promise<string | null> {
    const token = await getAuthToken();
    if (!token) return null;

    const payload = await verifyToken(token);
    return payload?.username || null;
}
