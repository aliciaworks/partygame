/**
 * Authentication utilities for token signing and verification
 * - Player tokens: HMAC-SHA256(playerId + timestamp, SECRET_KEY)
 * - Admin secret: environment variable validation
 */

/**
 * Create signed token using HMAC-SHA256
 * Format: base64(JSON.stringify({ playerId, timestamp, signature }))
 */
export async function createSignedToken(
  playerId: string,
  secretKey: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000); // Unix seconds
  const message = `${playerId}:${timestamp}`;

  // Use Web Crypto API (available in Cloudflare Workers)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const token = {
    playerId,
    timestamp,
    signature: signatureHex,
  };

  return btoa(JSON.stringify(token));
}

export interface TokenPayload {
  playerId: string;
  timestamp: number;
  signature: string;
}

/**
 * Verify signed token and extract playerId
 * Returns null if invalid, expired, or signature mismatch
 */
export async function verifySignedToken(
  token: string,
  secretKey: string,
  maxAgeSeconds: number = 300, // 5 minutes default
): Promise<string | null> {
  try {
    // Parse token
    const payload = JSON.parse(atob(token)) as Partial<TokenPayload>;

    if (!payload.playerId || !payload.timestamp || !payload.signature) {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now - payload.timestamp > maxAgeSeconds) {
      return null;
    }

    // Verify signature
    const message = `${payload.playerId}:${payload.timestamp}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
      "verify",
    ]);

    const expectedSignature = payload.signature;
    const computedSig = await crypto.subtle.sign("HMAC", key, messageData);
    const computedHex = Array.from(new Uint8Array(computedSig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedHex !== expectedSignature) {
      return null;
    }

    return payload.playerId;
  } catch {
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
    // No secret configured - allow (dev mode)
    console.warn("ADMIN_SECRET not configured, accepting all admin requests");
    return true;
  }

  if (!authHeader) {
    return false;
  }

  const [scheme, secret] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !secret) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(secret, envAdminSecret);
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
