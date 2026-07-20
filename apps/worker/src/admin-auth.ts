/**
 * Admin authentication — better-auth + D1 + drizzle-orm.
 *
 * Supports: Password · Google OAuth · GitHub OAuth · 2FA TOTP
 *
 * Setup:
 *   1. npx wrangler d1 execute partygame-db --remote --file=./migrations/001-admin-auth.sql
 *   2. wrangler secret put BETTER_AUTH_SECRET     (random string for JWT signing)
 *   3. wrangler secret put GOOGLE_CLIENT_ID        (optional)
 *   4. wrangler secret put GOOGLE_CLIENT_SECRET    (optional)
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins/two-factor";
import { drizzle } from "drizzle-orm/d1";

export function createAuth(d1: D1Database, baseURL: string, env: any) {
  const db = drizzle(d1);

  const providers: Record<string, any> = {};

  // Google OAuth
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  // GitHub OAuth
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }

  const secret = env.BETTER_AUTH_SECRET || env.ADMIN_SECRET || env.ADMIN_TOKEN || "partygame-better-auth-secret-change-me";

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    socialProviders: providers,
    plugins: [twoFactor()],
    trustedOrigins: [baseURL, "http://localhost:8787", "http://localhost:5173"],
    secret,
  });
}

/** What login methods are available */
export function authMethods(env: any) {
  return {
    password: true,
    google: env.GOOGLE_CLIENT_ID ? { clientId: env.GOOGLE_CLIENT_ID } : false,
    github: env.GITHUB_CLIENT_ID ? { clientId: env.GITHUB_CLIENT_ID } : false,
    totp: true,
  };
}
