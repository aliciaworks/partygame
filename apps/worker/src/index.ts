import { Hono } from "hono";
import { cors } from "hono/cors";
import { getModuleManifests, mountModules } from "./modules/loader";
import type { PlatformFeatures, PlatformState } from "./platform-state";
import {
  patchPlatformFeatures,
  patchPlatformState,
  readPlatformState,
  getDeprecationWarning,
  isDeprecatedPath,
  isClientVersionCompatible,
} from "./platform-state";
import { verifyAdminSecret } from "./auth-utils";
import { handleForbidden, errorCodeToStatus } from "./error-handler";
import { enforceRateLimit, rateLimitResponse } from "./rate-limit";
import { PlatformStateConflictError } from "./platform-state";
import { ADMIN_INDEX_HTML } from "./admin-index.generated";
import { AGENT_CONFIG } from "./well-known";
import { OPENAPI_YAML } from "./openapi-yaml";
import { createAuth, authMethods, isFirstUser, bootstrapAdmin, createInvite, acceptInvite } from "./admin-auth";
import { jwtVerify } from "jose";
export { GameRoom } from "./game/game-room";
export { MatchmakerRoom } from "./matchmaker/matchmaker-room";
export { ChatRoom } from "./chat/chat-room";
export { GuildRoom } from "./guilds/guild-room";

import type { AppEnv } from "./env";

const app = new Hono<AppEnv>();

// CORS must run first so error responses still get CORS headers
app.use("*", cors({ origin: "*" }));

const moduleFeatureRequirements: Partial<Record<string, Array<keyof PlatformFeatures>>> = {
  communication: ["textChat", "voiceChat"],
  hotfix: ["gameUpdates"],
  player_progress: ["playerProfile", "leaderboard"],
};

// Middleware: Version negotiation and response header injection
app.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown-ip";
  const path = c.req.path;
  const limitKeyPrefix = path.startsWith("/admin/") ? "admin" : "public";
  const limit = path.startsWith("/admin/") ? 60 : 240;
  const windowMs = path.startsWith("/admin/") ? 60_000 : 60_000;
  const limited = enforceRateLimit(`${limitKeyPrefix}:${ip}`, limit, windowMs);
  if (!limited.ok) {
    return c.json(rateLimitResponse(limited.retryAfterSeconds), 429);
  }

  const platformState = await readPlatformState(c.env.PLATFORM_BUCKET);

  // Check client version compatibility if minClientVersion is set
  const clientVersion = c.req.header("X-Client-Version");
  if (platformState.minClientVersion && clientVersion) {
    if (!isClientVersionCompatible(clientVersion, platformState.minClientVersion)) {
      return c.json(
        {
          error: "CLIENT_VERSION_TOO_OLD",
          message: `Client version ${clientVersion} is no longer supported. Minimum required: ${platformState.minClientVersion}`,
          minClientVersion: platformState.minClientVersion,
        },
        410, // Gone
      );
    }
  }

  // Store platform state in context for later use
  c.set("platformState", platformState);

  // Check admin auth for /admin/* routes (skip auth endpoints)
  const isAdminRoute = c.req.path.startsWith("/admin");
  const isAuthRoute = c.req.path.startsWith("/admin/auth/");
  let isAdmin = false;
  if (isAdminRoute && !isAuthRoute) {
    const bearerToken = (c.req.header("authorization") || "").replace("Bearer ", "");

    // Try better-auth session first
    if (bearerToken && c.env.DB && c.env.BETTER_AUTH_SECRET) {
      try {
        const { payload } = await jwtVerify(bearerToken, new TextEncoder().encode(c.env.BETTER_AUTH_SECRET));
        if (payload.sub) { isAdmin = true; }
      } catch {}
    }

    // Fallback: old ADMIN_SECRET check
    if (!isAdmin) {
      const configuredSecret = c.env.ADMIN_SECRET ?? c.env.ADMIN_TOKEN;
      if (!configuredSecret) {
        return c.json({ error: "ADMIN_NOT_CONFIGURED", message: "No admin auth configured. Set BETTER_AUTH_SECRET or ADMIN_SECRET." }, 500);
      }
      if (!bearerToken && !c.req.header("x-admin-token")) {
        return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }
      const provided = c.req.header("x-admin-token") || bearerToken;
      if (!verifyAdminSecret(provided, configuredSecret)) {
        return c.json({ error: "UNAUTHORIZED", message: "Invalid credentials" }, 401);
      }
      isAdmin = true;
    }
  } else if (isAuthRoute) {
    isAdmin = true;
  }
  c.set("isAdmin", isAdmin);

  // Check for maintenance mode
  if (!isAdmin && platformState.maintenance?.enabled) {
    const now = new Date();
    const startTime = platformState.maintenance.startTime ? new Date(platformState.maintenance.startTime) : null;
    const endTime = platformState.maintenance.endTime ? new Date(platformState.maintenance.endTime) : null;

    let inMaintenance = true;
    if (startTime && now < startTime) inMaintenance = false;
    if (endTime && now > endTime) inMaintenance = false;

    if (inMaintenance) {
      return c.json(
        {
          error: "MAINTENANCE_MODE",
          message: platformState.maintenance.message || "Server is down for maintenance.",
          startTime: platformState.maintenance.startTime,
          endTime: platformState.maintenance.endTime,
        },
        503,
      );
    }
  }

  await next();

  // Inject version headers into response
  c.header("X-API-Version", platformState.apiVersion);
  
  // Return feature list for client feature detection
  const featureList = Object.entries(platformState.features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .join(",");
  c.header("X-Available-Features", featureList);

  // Check if this endpoint is deprecated
  const currentPath = c.req.path;
  const deprecation = isDeprecatedPath(currentPath, platformState.deprecations);
  if (deprecation) {
    c.header("X-Deprecation-Date", deprecation.removedAt);
    if (deprecation.alternative) {
      c.header("X-Deprecation-Alternative", deprecation.alternative);
    }
    const warning = getDeprecationWarning(deprecation);
    c.header("X-Deprecation-Warning", warning);
  }
});

mountModules(app);

app.get("/", (c) =>
  c.json({
    name: "PartyGame Worker",
    version: "modular",
    modules: getModuleManifests(),
  }),
);

app.get("/ws", (c) => {
  const roomId = c.req.query("roomId") || "default";
  const gameRoomNamespace = c.env.GAME_ROOM;
  if (!gameRoomNamespace) return c.json({ error: "Missing GAME_ROOM binding" }, 500);
  const id = gameRoomNamespace.idFromName(roomId);
  const stub = gameRoomNamespace.get(id);
  return stub.fetch(c.req.raw);
});

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// ── AI-Agent discoverable endpoints (no auth) ──
app.get("/.well-known/agent-config.json", (c) => c.json(AGENT_CONFIG));
app.get("/openapi.yaml", (c) => {
  c.header("Content-Type", "text/yaml; charset=utf-8");
  return c.body(OPENAPI_YAML);
});

// ── Admin auth (better-auth + D1) ──────────────────────────────────────
app.get("/admin/auth/methods", (c) => {
  return c.json(authMethods(c.env));
});

// Bootstrap: create first admin if no users exist
app.post("/admin/auth/bootstrap", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "No database" }, 500);
    const { password } = await c.req.json().catch(() => ({})) as any;
    if (!password) return c.json({ error: "Password required" }, 400);

    const adminSecret = c.env.ADMIN_SECRET || "";
    if (!adminSecret) return c.json({ error: "ADMIN_SECRET not configured" }, 500);
    if (password !== adminSecret) return c.json({ error: "Invalid ADMIN_SECRET" }, 403);

    // Create admin user directly in better-auth tables
    const id = crypto.randomUUID();
    const email = "admin@partygame.local";
    const now = new Date().toISOString();

    try { await c.env.DB.prepare("INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)").bind(id, "Admin", email, now, now).run(); }
    catch (e: any) { return c.json({ error: "DB error: " + e.message }, 500); }

    return c.json({ success: true, email, message: "First admin created. Now sign in." });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Invite: existing admin invites a new user
app.post("/admin/auth/invite", async (c) => {
  if (!c.env.DB) return c.json({ error: "No database" }, 500);
  const { email } = await c.req.json().catch(() => ({})) as any;
  if (!email) return c.json({ error: "Email required" }, 400);
  const token = await createInvite(c.env.DB, email, "admin");
  return c.json({ invited: true, token, link: `${new URL(c.req.url).origin}/admin/auth/accept?token=${token}` });
});

// Accept invite: create account from invite token
app.post("/admin/auth/accept", async (c) => {
  if (!c.env.DB) return c.json({ error: "No database" }, 500);
  const { token, password } = await c.req.json().catch(() => ({})) as any;
  if (!token || !password) return c.json({ error: "Token and password required" }, 400);
  const user = await acceptInvite(c.env.DB, token, password);
  if (!user) return c.json({ error: "Invalid or expired invite token" }, 400);
  return c.json({ success: true, email: user.email });
});

// ── Profile management ──────────────────────────────────────────────
app.patch("/admin/auth/profile", async (c) => {
  const bearer = (c.req.header("authorization") || "").replace("Bearer ", "");
  if (!bearer) return c.json({ error: "Auth required" }, 401);
  const { email, newPassword } = await c.req.json().catch(() => ({})) as any;
  if (email && c.env.DB) {
    await c.env.DB.prepare("UPDATE user SET email = ?, updatedAt = datetime('now') WHERE id = (SELECT userId FROM session WHERE token = ? LIMIT 1)").bind(email, bearer).run();
  }
  if (newPassword && c.env.DB) {
    // PBKDF2 hash
    const s = crypto.getRandomValues(new Uint8Array(16));
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(newPassword), "PBKDF2", false, ["deriveBits"]);
    const b = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: s, iterations: 100000, hash: "SHA-256" }, k, 256);
    const hash = btoa(String.fromCharCode(...new Uint8Array(b)));
    const salt = btoa(String.fromCharCode(...s));
    await c.env.DB.prepare("UPDATE account SET password = ? WHERE userId = (SELECT userId FROM session WHERE token = ? LIMIT 1)").bind(`${salt}:${hash}`, bearer).run();
  }
  return c.json({ updated: true });
});

// ── Passkey / WebAuthn ────────────────────────────────────────────────
app.post("/admin/auth/passkey/register", async (c) => {
  const { userId, credentialId, publicKey, deviceName } = await c.req.json().catch(() => ({})) as any;
  if (!userId || !credentialId || !publicKey) return c.json({ error: "Missing fields" }, 400);
  if (!c.env.DB) return c.json({ error: "No database" }, 500);
  await c.env.DB.prepare("INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, device_name) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, credentialId, publicKey, deviceName || "Unknown").run();
  return c.json({ registered: true });
});

app.get("/admin/auth/passkey/list", async (c) => {
  const bearer = (c.req.header("authorization") || "").replace("Bearer ", "");
  if (!bearer || !c.env.DB) return c.json({ error: "Auth required" }, 401);
  const { results } = await c.env.DB.prepare("SELECT id, credential_id, device_name, created_at FROM passkey_credentials WHERE user_id = (SELECT userId FROM session WHERE token = ? LIMIT 1)").bind(bearer).all();
  return c.json({ credentials: results || [] });
});

app.delete("/admin/auth/passkey/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "No database" }, 500);
  await c.env.DB.prepare("DELETE FROM passkey_credentials WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ removed: true });
});

// Mount better-auth handler for sign-in / callback / session
app.on(["POST"], "/admin/auth/*", async (c) => {
  if (!c.env.DB) return c.json({ error: "D1 database not available" }, 500);
  const url = new URL(c.req.url);
  const auth = createAuth(c.env.DB, url.origin, c.env);
  return auth.handler(c.req.raw);
});

app.get("/admin/modules", async (c) => {
  const state = await readPlatformState(c.env.PLATFORM_BUCKET);

  return c.json({
    modules: getModuleManifests().map((module) => {
      const needs = moduleFeatureRequirements[module.id];
      const enabled =
        !needs || needs.every((featureKey) => state.features[featureKey]);

      return {
        ...module,
        enabled,
      };
    }),
  });
});

app.get("/admin/modules/:id/manifest", (c) => {
  const moduleId = c.req.param("id");
  const module = getModuleManifests().find((entry) => entry.id === moduleId);

  if (!module) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(module);
});

app.get("/api/platform", async (c) =>
  c.json(await readPlatformState(c.env.PLATFORM_BUCKET)),
);

app.get("/admin/platform", async (c) =>
  c.json(await readPlatformState(c.env.PLATFORM_BUCKET)),
);

app.patch("/admin/platform/features", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const expectedRevision = Number(c.req.header("if-match") ?? (body as { revision?: unknown }).revision);
  try {
    return c.json(
      await patchPlatformFeatures(
        c.env.PLATFORM_BUCKET,
        body,
        Number.isFinite(expectedRevision) ? expectedRevision : undefined,
      ),
    );
  } catch (error) {
    if (error instanceof PlatformStateConflictError) {
      return c.json(
        {
          error: "CONFLICT",
          message: "Platform state has changed, reload before updating",
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
        },
        409,
      );
    }
    throw error;
  }
});

app.patch("/admin/platform", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const expectedRevision = Number(c.req.header("if-match") ?? (body as { revision?: unknown }).revision);
  try {
    return c.json(
      await patchPlatformState(
        c.env.PLATFORM_BUCKET,
        body,
        Number.isFinite(expectedRevision) ? expectedRevision : undefined,
      ),
    );
  } catch (error) {
    if (error instanceof PlatformStateConflictError) {
      return c.json(
        {
          error: "CONFLICT",
          message: "Platform state has changed, reload before updating",
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
        },
        409,
      );
    }
    throw error;
  }
});

// Admin SPA catch-all: serve index.html for /admin/* client-side routes.
// Static files (/admin/assets/*) are handled by wrangler's [assets] system.
// NOTE: this catch-all must be the LAST /admin route to avoid shadowing
// specific /admin/* handlers defined above and by modules.
app.get("/admin", (c) => c.html(ADMIN_INDEX_HTML));
app.get("/admin/*", (c) => c.html(ADMIN_INDEX_HTML));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext) {
    // Process background tasks (e.g., post-match XP/Coins processing)
    for (const message of batch.messages) {
      console.log(`Processing message from queue:`, message.id);
      
      const data = message.body;
      if (data.type === "MATCH_END") {
        console.log(`Match ${data.matchId} ended! Processing ${data.players.length} players...`);
        
        if (env.DB && Array.isArray(data.players)) {
          const stmts = data.players.map((playerId: string) => {
            const isWinner = playerId === data.winnerId;
            const pointsAdded = isWinner ? 10 : 2;
            const playerName = "Player"; // We can resolve name later or assume it's just 'Player'

            return env.DB.prepare(
              `INSERT INTO leaderboard (leaderboard_id, player_id, player_name, score) 
               VALUES ('global_rank', ?, ?, ?) 
               ON CONFLICT(leaderboard_id, player_id) DO UPDATE SET 
               score = leaderboard.score + excluded.score, 
               updated_at = CURRENT_TIMESTAMP`
            ).bind(playerId, playerName, pointsAdded);
          });

          if (stmts.length > 0) {
            try {
              await env.DB.batch(stmts);
              console.log(`Successfully updated D1 leaderboard for ${stmts.length} players.`);
            } catch (err) {
              console.error("Failed to update D1 leaderboard batch", err);
            }
          }
        }
      }

      message.ack();
    }
  }
};
