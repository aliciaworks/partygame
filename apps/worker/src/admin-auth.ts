/**
 * Admin auth — better-auth + D1 + invite-only registration.
 *
 * Bootstrap: if no users exist, first sign-in with ADMIN_SECRET creates admin.
 * After bootstrap: only existing admins can invite new users.
 *
 * Setup:
 *   wrangler secret put ADMIN_SECRET        (bootstrap password)
 *   wrangler secret put BETTER_AUTH_SECRET   (JWT signing)
 *   wrangler secret put GOOGLE_CLIENT_ID     (optional)
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins/two-factor";
import { bearer } from "better-auth/plugins/bearer";
import { drizzle } from "drizzle-orm/d1";

export function createAuth(d1: D1Database, baseURL: string, env: any) {
  const db = drizzle(d1);
  const providers: Record<string, any> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }

  const secret = env.BETTER_AUTH_SECRET || env.ADMIN_SECRET || env.ADMIN_TOKEN || "dev-secret-change-me";

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    socialProviders: providers,
    plugins: [twoFactor(), bearer()],
    trustedOrigins: [baseURL, "http://localhost:8787", "http://localhost:5173"],
    secret,
  });
}

export function authMethods(env: any) {
  return {
    password: true,
    google: env.GOOGLE_CLIENT_ID ? { clientId: env.GOOGLE_CLIENT_ID } : false,
    github: env.GITHUB_CLIENT_ID ? { clientId: env.GITHUB_CLIENT_ID } : false,
    totp: true,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Bootstrap + Invite system
// ══════════════════════════════════════════════════════════════════════════════

/** Check if this is the first-ever user (bootstrap mode) */
export async function isFirstUser(db: D1Database): Promise<boolean> {
  try {
    const r = await db.prepare("SELECT COUNT(*) as c FROM user").first<{ c: number }>();
    return !r || r.c === 0;
  } catch {
    // Table doesn't exist yet — bootstrap mode
    return true;
  }
}

/** Bootstrap: create first admin user using ADMIN_SECRET as password */
export async function bootstrapAdmin(db: D1Database, password: string, adminSecret: string): Promise<{ id: string; email: string } | null> {
  if (!adminSecret || password !== adminSecret) return null;

  const id = crypto.randomUUID();
  const email = "admin@partygame.local";
  const now = new Date().toISOString();

  // Insert directly into better-auth's user table
  await db.prepare(
    `INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).bind(id, "Admin", email, now, now).run();

  // Also create in account table with password
  const { hash, salt } = await hashPasswordPBKDF2(password);
  await db.prepare(
    `INSERT OR IGNORE INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
     VALUES (?, ?, ?, 'credential', ?, ?, ?)`
  ).bind(crypto.randomUUID(), id, email, `${salt}:${hash}`, now, now).run();

  return { id, email };
}

/** Create invite token for a new admin */
export async function createInvite(db: D1Database, email: string, invitedBy: string): Promise<string> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await db.prepare(
    `INSERT INTO admin_invites (id, email, token, invited_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, email, token, invitedBy, expires, now).run();

  return token;
}

/** Consume an invite token and create the user */
export async function acceptInvite(
  db: D1Database, token: string, password: string,
): Promise<{ id: string; email: string } | null> {
  const invite = await db.prepare(
    "SELECT * FROM admin_invites WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
  ).bind(token).first<{ id: string; email: string; invited_by: string }>();

  if (!invite) return null;

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, ?, ?)`
  ).bind(userId, invite.email.split("@")[0], invite.email, now, now).run();

  const { hash, salt } = await hashPasswordPBKDF2(password);
  await db.prepare(
    `INSERT OR IGNORE INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
     VALUES (?, ?, ?, 'credential', ?, ?, ?)`
  ).bind(crypto.randomUUID(), userId, invite.email, `${salt}:${hash}`, now, now).run();

  // Mark invite as used
  await db.prepare("UPDATE admin_invites SET used = 1 WHERE id = ?").bind(invite.id).run();

  return { id: userId, email: invite.email };
}

// ══════════════════════════════════════════════════════════════════════════════
// PBKDF2 password hashing
// ══════════════════════════════════════════════════════════════════════════════

async function hashPasswordPBKDF2(password: string, salt?: Uint8Array): Promise<{ hash: string; salt: string }> {
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: s, iterations: 100_000, hash: "SHA-256" }, key, 256,
  );
  return {
    hash: btoa(String.fromCharCode(...new Uint8Array(bits))),
    salt: btoa(String.fromCharCode(...s)),
  };
}
