/**
 * JWT auth using Web Crypto API — zero dependencies, no nodejs_compat needed.
 *
 * Replaces `jose`. Workers' Web Crypto API handles:
 *   - HMAC-SHA256 for player token signing/verification
 *   - RS256 for Google/Apple OAuth JWT verification
 */

// ══════════════════════════════════════════════════════════════════════════════
// Base64 helpers
// ══════════════════════════════════════════════════════════════════════════════

function b64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ══════════════════════════════════════════════════════════════════════════════
// Player tokens: HMAC-SHA256
// ══════════════════════════════════════════════════════════════════════════════

export async function createSignedToken(playerId: string, secret: string): Promise<string> {
  const header = b64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(encoder.encode(JSON.stringify({
    playerId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  })));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data) as BufferSource)));
  return `${data}.${sig}`;
}

export async function verifySignedToken(token: string, secret: string): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p] = parts;
    const data = `${h}.${p}`;
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret) as BufferSource,
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sig = b64urlDecode(parts[2]);
    const valid = await crypto.subtle.verify("HMAC", key, sig as BufferSource, encoder.encode(data) as BufferSource);
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(b64urlDecode(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.playerId || null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════
// OAuth JWT verification (RS256 — Google/Apple)
// ══════════════════════════════════════════════════════════════════════════════

type JWK = { kty: string; n: string; e: string; kid?: string };
type JWKS = { keys: JWK[] };

/** Fetch and cache JWKS keys */
let jwksCache: Map<string, { keys: JWKS; expires: number }> = new Map();

async function fetchJWKS(url: string): Promise<JWKS> {
  const cached = jwksCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const res = await fetch(url);
  const keys = await res.json() as JWKS;
  jwksCache.set(url, { keys, expires: Date.now() + 3600_000 }); // 1 hour cache
  return keys;
}

/** Import a RS256 JWK as a CryptoKey */
async function importRS256Key(jwk: JWK): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

/** Verify a Google/Apple OAuth JWT against JWKS */
export async function verifyOAuthJWT(token: string, jwksUrl: string, issuer: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p] = parts;
    const header = JSON.parse(decoder.decode(b64urlDecode(h)));
    const payload = JSON.parse(decoder.decode(b64urlDecode(p)));

    // Check issuer
    if (payload.iss !== issuer) return null;
    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Get the right key
    const jwks = await fetchJWKS(jwksUrl);
    let jwk = jwks.keys.find(k => k.kid === header.kid) || jwks.keys[0];
    if (!jwk) return null;

    const key = await importRS256Key(jwk);
    const data = encoder.encode(`${h}.${p}`);
    const sig = b64urlDecode(parts[2]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig as BufferSource, data as BufferSource);
    return valid ? payload : null;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════
// Admin secret verification (constant-time)
// ══════════════════════════════════════════════════════════════════════════════

export function verifyAdminSecret(authHeader: string | null, envAdminSecret: string | undefined): boolean {
  if (!envAdminSecret || !authHeader) return false;
  const [scheme, token] = authHeader.split(" ");
  const provided = scheme?.toLowerCase() === "bearer" && token ? token : authHeader.trim();
  if (provided.length !== envAdminSecret.length) return false;
  let result = 0;
  for (let i = 0; i < provided.length; i++) result |= provided.charCodeAt(i) ^ envAdminSecret.charCodeAt(i);
  return result === 0;
}
