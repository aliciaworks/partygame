/**
 * Authentication utilities for token signing and verification
 * - Player tokens: HMAC-SHA256(playerId + timestamp, SECRET_KEY)
 * - Admin secret: environment variable validation
 */

import { SignJWT, jwtVerify } from "jose";

/**
 * Create signed JWT token using jose
 */
export async function createSignedToken(
  playerId: string,
  secretKey: string,
): Promise<string> {
  const secret = new TextEncoder().encode(secretKey);
  const alg = "HS256";

  const jwt = await new SignJWT({ playerId })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("5m") // Default 5 minutes
    .sign(secret);

  return jwt;
}

export interface TokenPayload {
  playerId: string;
}

/**
 * Verify signed JWT token and extract playerId
 */
export async function verifySignedToken(
  token: string,
  secretKey: string,
  maxAgeSeconds?: number, // Maintained for backwards compatibility, though exp handles it
): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret);

    if (payload && typeof payload.playerId === "string") {
      return payload.playerId;
    }
    return null;
  } catch {
    // Return null on expired or invalid signature
    return null;
  }
}

/**
 * Verify admin secret from environment
 * Expected header format: "Bearer {ADMIN_SECRET}"
 */
export function verifyAdminSecret(
  authHeader: string | null,
  envAdminSecret: string | undefined,
): boolean {
  if (!envAdminSecret) {
    return false;
  }

  if (!authHeader) {
    return false;
  }

  const [scheme, token] = authHeader.split(" ");
  const providedSecret = scheme?.toLowerCase() === "bearer" && token ? token : authHeader.trim();

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(providedSecret, envAdminSecret);
}

/**
 * Constant-time string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract player auth context from request
 * Supports both Bearer token header and query parameter (for WebSocket fallback)
 */
export async function extractPlayerContext(
  request: Request,
  secretKey: string,
): Promise<{ playerId: string } | null> {
  // Try Bearer token header first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) {
      const playerId = await verifySignedToken(token, secretKey);
      if (playerId) {
        return { playerId };
      }
    }
  }

  // Fallback to query parameter
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token) {
    const playerId = await verifySignedToken(token, secretKey);
    if (playerId) {
      return { playerId };
    }
  }

  return null;
}
