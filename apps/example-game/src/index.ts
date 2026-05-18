import { Hono } from "hono";
import {
  GameRoom,
  generateTokenPair,
  initializeJWT,
  verifyAccessToken,
  type JWTPayload,
} from "@partygame/core";
import {
  buildVoiceRoomBootstrap,
  isRouteAllowed,
  loadPlatformControls,
  savePlatformControls,
  storeGameUpdateAsset,
  updateSingleControl,
  type PlatformControls,
  type PlatformBindings,
} from "./platform-controls";

// Export the Durable Object so Cloudflare can bind to it.
export { GameRoom };

type ExampleEnv = {
  DB: any;
  GAME_ROOM: any;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
} & PlatformBindings;

const app = new Hono<{ Bindings: ExampleEnv }>();

let jwtConfigured = false;

function ensureJwtConfigured(env: ExampleEnv) {
  if (jwtConfigured) {
    return;
  }

  initializeJWT({
    secret: env.JWT_SECRET || "dev-secret-key",
    refreshSecret: env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
  });

  jwtConfigured = true;
}

function buildCorsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Access-Control-Expose-Headers": "Content-Type",
  });
}

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(),
    });
  }

  await next();
  const headers = buildCorsHeaders();
  headers.forEach((value, key) => {
    c.res.headers.set(key, value);
  });
});

app.use("/api/*", async (c, next) => {
  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);
  if (!isRouteAllowed(c.req.path, controls)) {
    return c.json(
      {
        error: "Feature disabled",
        path: c.req.path,
      },
      503
    );
  }

  return next();
});

app.use("/admin/*", async (c, next) => {
  const expectedToken = c.env.ADMIN_TOKEN || "dev-admin-token";
  const providedToken = c.req.header("x-admin-token");

  if (!providedToken || providedToken !== expectedToken) {
    return c.json(
      {
        error: "Admin access required",
      },
      401
    );
  }

  return next();
});

app.get("/", (c) => c.text("PartyGame backend API"));

app.get("/home", (c) => c.text("PartyGame backend API"));

app.post("/api/session/login", async (c) => {
  ensureJwtConfigured(c.env);

  const body = (await c.req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return c.json(
      {
        error: "Email and password are required",
      },
      400
    );
  }

  const playerName = body.email.split("@")[0] || "player";
  const playerId = `player-${playerName}-${Date.now()}`;
  const tokens = await generateTokenPair({
    playerId,
    playerName,
    email: body.email,
  });

  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);

  return c.json({
    ...tokens,
    playerId,
    playerName,
    voiceEnabled: controls.voiceChatEnabled,
  });
});

app.get("/api/session/me", async (c) => {
  ensureJwtConfigured(c.env);

  const authorization = c.req.header("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!token) {
    return c.json(
      {
        error: "Missing bearer token",
      },
      401
    );
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return c.json(
      {
        error: "Invalid or expired token",
      },
      401
    );
  }

  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);

  return c.json({
    playerId: payload.playerId,
    playerName: payload.playerName,
    email: payload.email ?? null,
    voiceEnabled: controls.voiceChatEnabled,
    backendHealthy: true,
  });
});

// Basic HTTP endpoint to create or join a room.
app.get("/rooms/:id", (c) => {
  const roomId = c.req.param("id");

  return c.text(`Connect via WS to room ${roomId}`);
});

app.get("/admin", (c) =>
  c.json({
    message: "Admin frontend is hosted in apps/admin.",
  })
);

app.get("/admin/config", async (c) => {
  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);
  return c.json({ controls });
});

app.put("/admin/config", async (c) => {
  const body = (await c.req.json()) as Partial<Record<string, boolean>>;
  const updated = await savePlatformControls(c.env.CONTROLS_BUCKET, {
    voiceChatEnabled: body.voiceChatEnabled,
    chatEnabled: body.chatEnabled,
    leaderboardEnabled: body.leaderboardEnabled,
    achievementsEnabled: body.achievementsEnabled,
    replayEnabled: body.replayEnabled,
    analyticsEnabled: body.analyticsEnabled,
    spectatorEnabled: body.spectatorEnabled,
    gameUpdatesEnabled: body.gameUpdatesEnabled,
  });

  return c.json({ controls: updated });
});

app.post("/admin/features/:name", async (c) => {
  const controlName = c.req.param("name");
  const body = (await c.req.json()) as { enabled?: boolean };

  const knownControls = new Set([
    "voiceChatEnabled",
    "chatEnabled",
    "leaderboardEnabled",
    "achievementsEnabled",
    "replayEnabled",
    "analyticsEnabled",
    "spectatorEnabled",
    "gameUpdatesEnabled",
  ]);

  if (!knownControls.has(controlName)) {
    return c.json(
      {
        error: "Unknown control",
      },
      400
    );
  }

  if (typeof body.enabled !== "boolean") {
    return c.json(
      {
        error: "enabled must be a boolean",
      },
      400
    );
  }

  const controls = await updateSingleControl(
    c.env.CONTROLS_BUCKET,
    controlName as keyof PlatformControls,
    body.enabled
  );

  return c.json({ controls });
});

app.post("/admin/voice/rooms/:roomId/bootstrap", async (c) => {
  const roomId = c.req.param("roomId") || "";
  if (!roomId) {
    return c.json(
      {
        error: "roomId is required",
      },
      400
    );
  }

  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);
  const bootstrap = buildVoiceRoomBootstrap(roomId, controls, c.env);
  return c.json({ bootstrap });
});

app.post("/api/voice/rooms/:roomId/bootstrap", async (c) => {
  const roomId = c.req.param("roomId") || "";
  if (!roomId) {
    return c.json(
      {
        error: "roomId is required",
      },
      400
    );
  }

  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);
  const bootstrap = buildVoiceRoomBootstrap(roomId, controls, c.env);

  if (!bootstrap.enabled) {
    return c.json(
      {
        error: "Voice chat is disabled",
        bootstrap,
      },
      503
    );
  }

  return c.json({ bootstrap });
});

app.post("/admin/updates", async (c) => {
  const body = (await c.req.json()) as {
    name?: string;
    content?: string;
    contentType?: string;
  };

  if (!body.name || !body.content) {
    return c.json(
      {
        error: "name and content are required",
      },
      400
    );
  }

  const asset = await storeGameUpdateAsset(c.env.GAME_UPDATES_BUCKET, {
    name: body.name,
    content: body.content,
    contentType: body.contentType,
  });

  return c.json({ asset });
});

export default {
  fetch(request: Request, env: ExampleEnv, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
