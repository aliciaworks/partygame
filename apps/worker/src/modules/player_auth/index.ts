import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { createSignedToken, verifySignedToken } from "../../auth-utils";
import { createRemoteJWKSet, jwtVerify } from "jose";

// ── In-memory caches ────────────────────────────────────────────────────────

/** Player account cache: R2 reads are ~30ms, memory reads are <1ms. TTL=15s. */
const accountCache = new Map<string, { account: PlayerAccount; expiresAt: number }>();
const ACCOUNT_CACHE_TTL = 15_000;

/**
 * Verify a Cloudflare Turnstile token submitted by the client.
 * Returns true if valid or if TURNSTILE_SECRET is not configured (dev mode).
 */
async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  ip: string,
): Promise<boolean> {
  // Skip verification in dev mode (no secret configured)
  if (!secret) return true;
  if (!token) return false;

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v1/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });

  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

type AuthSession = {
  playerId: string;
  playerName: string;
  createdAt: string;
  expiresAt: string;
};

export type PlayerAccount = {
  playerId: string;
  playerName: string;
  createdAt: string;
  lastSeen: string;
  banned: boolean;
};

type AuthResponse = {
  token: string;
  playerId: string;
  playerName: string;
  expiresAt: string;
};

const PLAYER_ACCOUNT_PREFIX = "players/";
const PLAYER_ACCOUNT_SUFFIX = "/account.json";

function isLocalDevelopmentRequest(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function requirePlayerSecret(request: Request, secretKey: string | undefined): string | null {
  if (secretKey) return secretKey;
  if (isLocalDevelopmentRequest(request)) return null;
  throw new Error("PLAYER_SECRET is required in non-local environments");
}

async function createSignedTokenForPlayer(
  playerId: string,
  secretKey: string | undefined,
): Promise<string> {
  if (!secretKey) {
    // Fallback: use simple token if no secret
    return btoa(JSON.stringify({ playerId, nonce: crypto.randomUUID() }));
  }
  return await createSignedToken(playerId, secretKey);
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

async function saveAccount(bucket: R2Bucket | undefined, account: PlayerAccount) {
  if (!bucket) return;
  accountCache.delete(account.playerId);

  await bucket.put(accountKey(account.playerId), JSON.stringify(account, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function loadAccount(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<PlayerAccount | null> {
  if (!bucket) return null;

  // Check memory cache first
  const cached = accountCache.get(playerId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.account;
  }

  const object = await bucket.get(accountKey(playerId));
  if (!object) return null;

  try {
    const parsed = JSON.parse(await object.text()) as Partial<PlayerAccount>;
    if (typeof parsed.playerId !== "string") return null;

    const account: PlayerAccount = {
      playerId: parsed.playerId,
      playerName: typeof parsed.playerName === "string" ? parsed.playerName : "Player",
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : new Date().toISOString(),
      banned: typeof parsed.banned === "boolean" ? parsed.banned : false,
    };

    accountCache.set(playerId, { account, expiresAt: Date.now() + ACCOUNT_CACHE_TTL });
    return account;
  } catch {
    return null;
  }
}

function accountKey(playerId: string): string {
  return `${PLAYER_ACCOUNT_PREFIX}${playerId}${PLAYER_ACCOUNT_SUFFIX}`;
}

async function upsertAccount(
  bucket: R2Bucket | undefined,
  playerId: string,
  playerName: string,
): Promise<PlayerAccount> {
  const current = (await loadAccount(bucket, playerId)) ?? {
    playerId,
    playerName,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    banned: false,
  };

  const next: PlayerAccount = {
    ...current,
    playerName,
    lastSeen: new Date().toISOString(),
  };

  await saveAccount(bucket, next);
  return next;
}

export async function getPlayerAccount(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<PlayerAccount | null> {
  return loadAccount(bucket, playerId);
}

export async function listPlayerAccounts(
  bucket: R2Bucket | undefined,
  limit = 100,
  cursor?: string,
): Promise<{ players: PlayerAccount[]; cursor?: string }> {
  if (!bucket) {
    return { players: [] };
  }

  const listed = await bucket.list({ prefix: PLAYER_ACCOUNT_PREFIX, cursor, limit });
  const players: PlayerAccount[] = [];

  for (const object of listed.objects) {
    if (!object.key.endsWith(PLAYER_ACCOUNT_SUFFIX)) {
      continue;
    }

    const loaded = await bucket.get(object.key);
    if (!loaded) continue;

    try {
      const parsed = JSON.parse(await loaded.text()) as Partial<PlayerAccount>;
      if (typeof parsed.playerId !== "string") continue;
      players.push({
        playerId: parsed.playerId,
        playerName: typeof parsed.playerName === "string" ? parsed.playerName : "Player",
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
        lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : new Date().toISOString(),
        banned: typeof parsed.banned === "boolean" ? parsed.banned : false,
      });
    } catch {
      continue;
    }
  }

  return { players, cursor: listed.truncated ? listed.cursor : undefined };
}

async function readSession(
  request: Request,
  secretKey: string | undefined,
): Promise<AuthSession | null> {
  if (!secretKey && !isLocalDevelopmentRequest(request)) {
    return null;
  }

  const token = readBearerToken(request) ?? new URL(request.url).searchParams.get("token");
  if (!token) return null;

  // Try to verify signed token first
  if (secretKey) {
    const playerId = await verifySignedToken(token, secretKey, 300); // 5 min
    if (playerId) {
      // Token is valid, return synthetic session
      return {
        playerId,
        playerName: "Player", // Will be fetched from account if needed
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    }
  }

  // Without a valid signed token, we cannot authenticate
  return null;
}

export const playerAuthManifest: ModuleManifest = {
  id: "player_auth",
  name: "Player auth",
  description: "Session-based player identity and login lifecycle.",
  icon: "ti-shield-lock",
};

export const playerAuthModule: WorkerModule = {
  manifest: playerAuthManifest,
  init(app: Hono<any>) {
    app.post("/auth/register", async (c) => {
      const ip = c.req.header("CF-Connecting-IP") ?? "unknown-ip";
      if (c.env.AUTH_RATE_LIMITER) {
        const { success } = await c.env.AUTH_RATE_LIMITER.limit({ key: ip });
        if (!success) return c.json({ error: "RATE_LIMITED", message: "Too many requests" }, 429);
      }

      const body = (await c.req.json().catch(() => ({}))) as {
        playerName?: unknown;
        turnstileToken?: string;
      };

      // Verify Turnstile CAPTCHA to block bot-driven account creation
      const turnstileOk = await verifyTurnstile(
        body.turnstileToken,
        c.env.TURNSTILE_SECRET,
        ip,
      );
      if (!turnstileOk) {
        return c.json({ error: "TURNSTILE_FAILED", message: "Bot verification failed" }, 403);
      }

      const playerName =
        typeof body.playerName === "string" && body.playerName.trim()
          ? body.playerName.trim()
          : "Player";

      const playerId = `player-${crypto.randomUUID()}`;
      await upsertAccount(c.env.PLATFORM_BUCKET, playerId, playerName);

      // Create signed token
      let secret: string | null;
      try {
        secret = requirePlayerSecret(
          c.req.raw,
          (c.env as { PLAYER_SECRET?: string }).PLAYER_SECRET,
        );
      } catch (error) {
        return c.json({ error: "SERVER_MISCONFIG", message: (error as Error).message }, 500);
      }
      const signedToken = await createSignedTokenForPlayer(playerId, secret ?? undefined);

      return c.json(
        {
          token: signedToken,
          playerId,
          playerName,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
        201,
      );
    });

    app.post("/auth/login", async (c) => {
      const ip = c.req.header("CF-Connecting-IP") ?? "unknown-ip";
      if (c.env.AUTH_RATE_LIMITER) {
        const { success } = await c.env.AUTH_RATE_LIMITER.limit({ key: ip });
        if (!success) return c.json({ error: "RATE_LIMITED", message: "Too many requests" }, 429);
      }

      const body = (await c.req.json().catch(() => ({}))) as {
        playerId?: unknown;
        playerName?: unknown;
      };

      const playerId =
        typeof body.playerId === "string" && body.playerId.trim()
          ? body.playerId.trim()
          : `player-${crypto.randomUUID()}`;
      const playerName =
        typeof body.playerName === "string" && body.playerName.trim()
          ? body.playerName.trim()
          : "Player";

      await upsertAccount(c.env.PLATFORM_BUCKET, playerId, playerName);

      // Create signed token
      let secret: string | null;
      try {
        secret = requirePlayerSecret(
          c.req.raw,
          (c.env as { PLAYER_SECRET?: string }).PLAYER_SECRET,
        );
      } catch (error) {
        return c.json({ error: "SERVER_MISCONFIG", message: (error as Error).message }, 500);
      }
      const signedToken = await createSignedTokenForPlayer(playerId, secret ?? undefined);

      return c.json({
        token: signedToken,
        playerId,
        playerName,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    });

    app.post("/auth/google", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        idToken?: string;
      };

      if (!body.idToken) {
        return c.json({ error: "MISSING_TOKEN" }, 400);
      }

      try {
        const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
        const { payload } = await jwtVerify(body.idToken, JWKS, {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
        });

        const googleId = payload.sub;
        if (!googleId) throw new Error("No sub in token");

        const playerName = payload.name?.toString() || payload.email?.toString().split('@')[0] || "Google Player";
        const playerId = `google-${googleId}`;

        await upsertAccount(c.env.PLATFORM_BUCKET, playerId, playerName);

      let secret: string | null;
      try {
        secret = requirePlayerSecret(c.req.raw, c.env.PLAYER_SECRET);
      } catch (error) {
        return c.json({ error: "SERVER_MISCONFIG", message: (error as Error).message }, 500);
      }
        const signedToken = await createSignedTokenForPlayer(playerId, secret ?? undefined);

        return c.json({
          token: signedToken,
          playerId,
          playerName,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      } catch (e) {
        return c.json({ error: "INVALID_GOOGLE_TOKEN" }, 401);
      }
    });

    app.post("/auth/apple", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        idToken?: string;
        name?: string; // Apple only sends name on first login
      };

      if (!body.idToken) {
        return c.json({ error: "MISSING_TOKEN" }, 400);
      }

      try {
        const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
        const { payload } = await jwtVerify(body.idToken, JWKS, {
          issuer: 'https://appleid.apple.com',
          // In a real app, audience should be verified against your Apple App ID
          // audience: 'com.your.app' 
        });

        const appleId = payload.sub;
        if (!appleId) throw new Error("No sub in token");

        const playerName = body.name || payload.email?.toString().split('@')[0] || "Apple Player";
        const playerId = `apple-${appleId}`;

        await upsertAccount(c.env.PLATFORM_BUCKET, playerId, playerName);

        let secret: string | null;
        try {
          secret = requirePlayerSecret(c.req.raw, c.env.PLAYER_SECRET);
        } catch (error) {
          return c.json({ error: "SERVER_MISCONFIG", message: (error as Error).message }, 500);
        }
        const signedToken = await createSignedTokenForPlayer(playerId, secret ?? undefined);

        return c.json({
          token: signedToken,
          playerId,
          playerName,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      } catch (e) {
        return c.json({ error: "INVALID_APPLE_TOKEN" }, 401);
      }
    });

    app.get("/auth/me", async (c) => {
      const session = await readSession(
        c.req.raw,
        (c.env as { PLAYER_SECRET?: string }).PLAYER_SECRET,
      );
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({
        playerId: session.playerId,
        playerName: session.playerName,
        expiresAt: session.expiresAt,
      });
    });

    app.post("/auth/refresh", async (c) => {
      const session = await readSession(
        c.req.raw,
        (c.env as { PLAYER_SECRET?: string }).PLAYER_SECRET,
      );
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Create new signed token
      let secret: string | null;
      try {
        secret = requirePlayerSecret(
          c.req.raw,
          (c.env as { PLAYER_SECRET?: string }).PLAYER_SECRET,
        );
      } catch (error) {
        return c.json({ error: "SERVER_MISCONFIG", message: (error as Error).message }, 500);
      }
      const signedToken = await createSignedTokenForPlayer(session.playerId, secret ?? undefined);

      return c.json({
        token: signedToken,
        playerId: session.playerId,
        playerName: session.playerName,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    });

    app.post("/auth/logout", (c) => {
      // With stateless JWTs, logout is purely a client-side action (dropping the token).
      // We no longer track active sessions on the server.
      return c.json({ success: true });
    });

    app.get("/auth/players/:id", async (c) => {
      const player = await getPlayerAccount(c.env.PLATFORM_BUCKET, c.req.param("id"));
      if (!player) {
        return c.json({ error: "Not found" }, 404);
      }

      return c.json({ player });
    });
  },
};
