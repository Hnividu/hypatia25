import { SignJWT, jwtVerify } from 'jose';

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE COMPATIBLE AUTH UTILITIES
// Safe for Middleware and Edge Functions
// ═══════════════════════════════════════════════════════════════════════════════

const JWT_SECRET = new TextEncoder().encode(
    (() => {
        // Simple check that doesn't rely on Node.js-only APIs if possible, but process.env is fine in Edge
        return process.env.JWT_SECRET || 'quiz-app-secret-key-change-in-production';
    })()
);

const TOKEN_EXPIRY = '7d';

export interface TokenPayload {
    username: string;
    role: 'admin';
    iat: number;
    exp: number;
}

/**
 * Create a JWT token for admin
 */
export async function createToken(username: string): Promise<string> {
    return new SignJWT({ username, role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        // Validate required fields exist
        if (
            typeof payload.username === 'string' &&
            payload.role === 'admin'
        ) {
            return {
                username: payload.username,
                role: payload.role,
                iat: payload.iat as number,
                exp: payload.exp as number,
            };
        }
        return null;
    } catch {
        return null;
    }
}
