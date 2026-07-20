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
import { authMethods, hashPassword, verifyPassword, generateTOTPSecret, verifyTOTP } from "./admin-auth";
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

    // Try D1-based auth token
    if (bearerToken && c.env.DB) {
      try {
        const row = await c.env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')").bind(bearerToken).first<{ user_id: string }>();
        if (row) { isAdmin = true; }
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

  // Edge cache: cache public GET responses for 60s
  if (c.req.method === "GET" && !c.req.path.startsWith("/admin") && !c.req.path.startsWith("/ws")) {
    c.header("Cache-Control", "public, max-age=60, s-maxage=60");
  }
  
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
    const { email, password } = await c.req.json().catch(() => ({})) as any;
    if (!email || !password) return c.json({ error: "Email and password required" }, 400);
    if (!c.env.DB) return c.json({ error: "No database" }, 500);
    const r = await c.env.DB.prepare("SELECT COUNT(*) as c FROM admin_users").first<{ c: number }>();
    if (r && r.c > 0) return c.json({ error: "Setup already complete" }, 400);
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    const { hash, salt } = await hashPassword(password);
    await c.env.DB.prepare("INSERT INTO admin_users (id, email, name, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, 'admin', ?)").bind(id, email, email.split("@")[0], hash, salt, now).run();
    return c.json({ success: true, email });
  } catch (e: any) {
    return c.json({ error: "BOOTSTRAP_FAILED: " + (e.message || String(e)) }, 500);
  }
});

app.get("/admin/auth/state", async (c) => {
  if (!c.env.DB) return c.json({ needsSetup: true });
  try { const r = await c.env.DB.prepare("SELECT COUNT(*) as c FROM admin_users").first<{ c: number }>(); return c.json({ needsSetup: !r || r.c === 0 }); }
  catch { return c.json({ needsSetup: true }); }
});

// Sign in
app.post("/admin/auth/sign-in", async (c) => {
  const { email, password, code } = await c.req.json().catch(() => ({})) as any;
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);
  if (!c.env.DB) return c.json({ error: "No database" }, 500);
  const user = await c.env.DB.prepare("SELECT * FROM admin_users WHERE email = ?").bind(email).first<any>();
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  // Verify password
  const valid = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  // 2FA check
  if (user.totp_enabled) {
    if (!code) return c.json({ error: "2FA code required", needs2FA: true }, 401);
    if (!verifyTOTP(user.totp_secret, code)) return c.json({ error: "Invalid 2FA code" }, 401);
  }

  // Create session
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), user.id, token, expires).run();

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, totp_enabled: !!user.totp_enabled } });
});

// Invite
app.post("/admin/auth/invite", async (c) => {
  const { email } = await c.req.json().catch(() => ({})) as any;
  if (!email || !c.env.DB) return c.json({ error: "Email required" }, 400);
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare("INSERT INTO admin_invites (id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), email, token, expires).run();
  return c.json({ token, link: `${new URL(c.req.url).origin}/admin?token=${token}` });
});

// Accept invite
app.post("/admin/auth/accept", async (c) => {
  const { token, email, password } = await c.req.json().catch(() => ({})) as any;
  if (!token || !email || !password || !c.env.DB) return c.json({ error: "Token, email and password required" }, 400);
  const inv = await c.env.DB.prepare("SELECT * FROM admin_invites WHERE token = ? AND used = 0 AND expires_at > datetime('now')").bind(token).first<any>();
  if (!inv) return c.json({ error: "Invalid or expired invite" }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  const { hash, salt } = await hashPassword(password);
  await c.env.DB.prepare("INSERT INTO admin_users (id, email, name, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, 'admin', ?)").bind(id, email, email.split("@")[0], hash, salt, now).run();
  await c.env.DB.prepare("UPDATE admin_invites SET used = 1 WHERE id = ?").bind(inv.id).run();
  return c.json({ success: true, email });
});

// 2FA enable
app.post("/admin/auth/2fa/enable", async (c) => {
  const bearer = (c.req.header("authorization") || "").replace("Bearer ", "");
  if (!bearer || !c.env.DB) return c.json({ error: "Auth required" }, 401);
  const s = await c.env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')").bind(bearer).first<{ user_id: string }>();
  if (!s) return c.json({ error: "Invalid session" }, 401);
  const secret = generateTOTPSecret();
  await c.env.DB.prepare("UPDATE admin_users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?").bind(secret, s.user_id).run();
  return c.json({ secret });
});

// Passkey register
app.post("/admin/auth/passkey/register", async (c) => {
  const bearer = (c.req.header("authorization") || "").replace("Bearer ", "");
  const { userId, credentialId, publicKey, deviceName } = await c.req.json().catch(() => ({})) as any;
  if (!userId || !credentialId || !publicKey || !c.env.DB) return c.json({ error: "Missing fields" }, 400);
  await c.env.DB.prepare("INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, device_name) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, credentialId, publicKey, deviceName || "Unknown").run();
  return c.json({ registered: true });
});

// Passkey list
app.get("/admin/auth/passkey/list", async (c) => {
  const bearer = (c.req.header("authorization") || "").replace("Bearer ", "");
  if (!bearer || !c.env.DB) return c.json({ error: "Auth required" }, 401);
  const s = await c.env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')").bind(bearer).first<{ user_id: string }>();
  if (!s) return c.json({ error: "Invalid session" }, 401);
  const { results } = await c.env.DB.prepare("SELECT id, credential_id, device_name, created_at FROM passkey_credentials WHERE user_id = ?").bind(s.user_id).all();
  return c.json({ credentials: results || [] });
});

// Profile
app.patch("/admin/auth/profile", async (c) => {
  const bearer = (c.req.header("authorization") || "").replace("Bearer ", "");
  if (!bearer || !c.env.DB) return c.json({ error: "Auth required" }, 401);
  const s = await c.env.DB.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')").bind(bearer).first<{ user_id: string }>();
  if (!s) return c.json({ error: "Invalid session" }, 401);
  const { email, newPassword } = await c.req.json().catch(() => ({})) as any;
  if (email) await c.env.DB.prepare("UPDATE admin_users SET email = ? WHERE id = ?").bind(email, s.user_id).run();
  if (newPassword) { const { hash, salt } = await hashPassword(newPassword); await c.env.DB.prepare("UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(hash, salt, s.user_id).run(); }
  return c.json({ updated: true });
});

// Mount better-auth handler for sign-in / callback / session
app.on(["POST"], "/admin/auth/*", async (c) => {
  return c.json({ error: "Not found" }, 404);
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
