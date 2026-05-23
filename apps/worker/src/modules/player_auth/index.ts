import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";

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

function createToken(playerId: string, playerName: string): string {
  return btoa(
    JSON.stringify({
      playerId,
      playerName,
      nonce: crypto.randomUUID(),
    }),
  );
}

function parseToken(token: string): { playerId: string; playerName: string } | null {
  try {
    const parsed = JSON.parse(atob(token)) as Partial<AuthResponse>;
    if (
      typeof parsed.playerId !== "string" ||
      typeof parsed.playerName !== "string"
    ) {
      return null;
    }

    return {
      playerId: parsed.playerId,
      playerName: parsed.playerName,
    };
  } catch {
    return null;
  }
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
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const token = createToken(playerId, playerName);

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

  return { players };
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

function readSession(request: Request): AuthSession | null {
  const token = readBearerToken(request) ?? new URL(request.url).searchParams.get("token");
  if (!token) return null;

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
      const session = createSession(playerId, playerName);

      return c.json(session, 201);
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

      return c.json(createSession(playerId, playerName));
    });

    app.get("/auth/me", (c) => {
      const session = readSession(c.req.raw);
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      return c.json({
        playerId: session.playerId,
        playerName: session.playerName,
        expiresAt: session.expiresAt,
      });
    });

    app.post("/auth/refresh", (c) => {
      const session = readSession(c.req.raw);
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const next = createSession(session.playerId, session.playerName);
      return c.json(next);
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
