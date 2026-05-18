import { Hono } from "hono";
// Import the base GameRoom from the core package
import { GameRoom } from "@partygame/core";
import { authRouter } from "@partygame/auth";
import {
  buildVoiceRoomBootstrap,
  isRouteAllowed,
  loadPlatformControls,
  renderAdminPanelHtml,
  savePlatformControls,
  storeGameUpdateAsset,
  updateSingleControl,
  type PlatformControls,
  type PlatformBindings,
} from "./platform-controls";

// Export the Durable Object so Cloudflare can bind to it
export { GameRoom };

type ExampleEnv = {
  DB: any;
  GAME_ROOM: any;
} & PlatformBindings;

const app = new Hono<{ Bindings: ExampleEnv }>();

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

// Mount the Auth Router
app.route("/", authRouter);

// Basic HTTP endpoint to create or join a room
app.get("/rooms/:id", (c) => {
  const roomId = c.req.param("id");

  // The actual connection logic would upgrade the request to a WebSocket
  // and route it to the GameRoom durable object.
  // Using partyserver's route helper:
  // return routePartykitRequest(c.req.raw, c.env);

  return c.text(`Connect via WS to room ${roomId}`);
});

app.get("/admin", async (c) => {
  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);
  return c.html(renderAdminPanelHtml(controls));
});

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
  fetch(request: Request, env: any, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
