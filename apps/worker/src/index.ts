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
export { GameRoom } from "./game/game-room";
export { MatchmakerRoom } from "./matchmaker/matchmaker-room";
export { ChatRoom } from "./chat/chat-room";
export { GuildRoom } from "./guilds/guild-room";

import type { AppEnv } from "./env";

const app = new Hono<AppEnv>();

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

  // Check admin secret for /admin/* routes
  const isAdminRoute = c.req.path.startsWith("/admin");
  let isAdmin = false;
  if (isAdminRoute) {
    const authHeader = c.req.header("authorization");
    const tokenHeader = c.req.header("x-admin-token");
    const providedSecret = authHeader ?? tokenHeader ?? null;
    const configuredSecret = c.env.ADMIN_SECRET ?? c.env.ADMIN_TOKEN;
    if (!verifyAdminSecret(providedSecret, configuredSecret)) {
      const err = handleForbidden("Admin secret required");
      return c.json(err, { status: errorCodeToStatus(err.error) } as any);
    }
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

app.use("*", cors({ origin: "*" }));

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
      if (data.type === "LEADERBOARD_SUBMIT") {
        // Batch leaderboard writes through the queue for lower latency
        try {
          await env.DB.prepare(
            `INSERT INTO leaderboard (leaderboard_id, player_id, player_name, score) 
             VALUES (?, ?, ?, ?) 
             ON CONFLICT(leaderboard_id, player_id) DO UPDATE SET 
             score = excluded.score, 
             player_name = excluded.player_name, 
             updated_at = CURRENT_TIMESTAMP 
             WHERE excluded.score > leaderboard.score`
          ).bind(data.leaderboardId, data.playerId, data.playerName, data.score).run();
        } catch (err) {
          console.error("Failed to process LEADERBOARD_SUBMIT", err);
        }
        message.ack();
        return;
      }

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
