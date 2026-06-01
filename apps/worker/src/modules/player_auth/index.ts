import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { createSignedToken, verifySignedToken } from "../../auth-utils";

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

const sessions = new Map<string, AuthSession>();
const sessionIndex = new Map<string, Set<string>>();

const PLAYER_ACCOUNT_PREFIX = "players/";
const PLAYER_ACCOUNT_SUFFIX = "/account.json";

function createToken(playerId: string, _playerName: string): string {
  // Deprecated: only for session storage key
  // Real tokens are created via createSignedToken in routes
  return `${playerId}:legacy`;
}

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

function createSession(playerId: string, playerName: string): AuthResponse {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
  // Token will be created asynchronously in the route handler
  // For now, use placeholder
  const token = `${playerId}:unsigned`;

  sessions.set(token, {
    playerId,
    playerName,
    createdAt,
    expiresAt,
  });

  return {
    token,
    playerId,
    playerName,
    expiresAt,
  };
}

async function saveAccount(bucket: R2Bucket | undefined, account: PlayerAccount) {
  if (!bucket) return;

  await bucket.put(accountKey(account.playerId), JSON.stringify(account, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function loadAccount(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<PlayerAccount | null> {
  if (!bucket) return null;

  const object = await bucket.get(accountKey(playerId));
  if (!object) return null;

  try {
    const parsed = JSON.parse(await object.text()) as Partial<PlayerAccount>;
    if (typeof parsed.playerId !== "string") return null;

    return {
      playerId: parsed.playerId,
      playerName: typeof parsed.playerName === "string" ? parsed.playerName : "Player",
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : new Date().toISOString(),
      banned: typeof parsed.banned === "boolean" ? parsed.banned : false,
    };
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

export function revokePlayerSessions(playerId: string): number {
  let removed = 0;
  for (const [token, session] of sessions.entries()) {
    if (session.playerId === playerId) {
      sessions.delete(token);
      removed += 1;
    }
  }
  sessionIndex.delete(playerId);
  return removed;
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

  // Fallback: check in-memory sessions (for legacy/testing)
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
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
      const body = (await c.req.json().catch(() => ({}))) as {
        playerName?: unknown;
      };

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
      const signedToken = secret
        ? await createSignedTokenForPlayer(playerId, secret)
        : createToken(playerId, playerName);

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
      const signedToken = secret
        ? await createSignedTokenForPlayer(playerId, secret)
        : createToken(playerId, playerName);

      return c.json({
        token: signedToken,
        playerId,
        playerName,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
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
      const signedToken = secret
        ? await createSignedTokenForPlayer(session.playerId, secret)
        : createToken(session.playerId, session.playerName);

      return c.json({
        token: signedToken,
        playerId: session.playerId,
        playerName: session.playerName,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    });

    app.post("/auth/logout", (c) => {
      const token = readBearerToken(c.req.raw) ?? new URL(c.req.url).searchParams.get("token");
      if (token) {
        sessions.delete(token);
      }

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
