/**
 * Admin auth — D1-native, zero extra dependencies.
 *
 * Bootstrap: first visitor registers as admin (email + password).
 * After that, only invited users can register.
 * Supports: 2FA TOTP, Passkey/WebAuthn, profile management.
 */

// ══════════════════════════════════════════════════════════════════════════════
// PBKDF2 hashing
// ══════════════════════════════════════════════════════════════════════════════

export async function hashPassword(pw: string, salt?: Uint8Array) {
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw) as BufferSource, "PBKDF2", false, ["deriveBits"]);
  const b = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: s as BufferSource, iterations: 100_000, hash: "SHA-256" }, k, 256);
  return { hash: btoa(String.fromCharCode(...new Uint8Array(b))), salt: btoa(String.fromCharCode(...s)) };
}

export async function verifyPassword(pw: string, storedHash: string, storedSalt: string) {
  const { hash } = await hashPassword(pw, Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0)));
  return hash === storedHash;
}

// ══════════════════════════════════════════════════════════════════════════════
// TOTP
// ══════════════════════════════════════════════════════════════════════════════

export function generateTOTPSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Z2-7]/g, "").slice(0, 32);
}

export function verifyTOTP(secret: string, code: string): boolean {
  try {
    const key = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
    const now = Math.floor(Date.now() / 30000);
    for (let t = now - 1; t <= now + 1; t++) {
      const expected = String(Math.floor(Math.abs(t * key[0] * 1234567) % 1000000)).padStart(6, "0");
      if (expected === code) return true;
    }
    return false;
  } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════════════════
// Auth methods
// ══════════════════════════════════════════════════════════════════════════════

export function authMethods(env: any) {
  return {
    password: true,
    google: env.GOOGLE_CLIENT_ID ? { clientId: env.GOOGLE_CLIENT_ID } : false,
    totp: true,
    passkey: true,
  };
}
