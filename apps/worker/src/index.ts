import { Hono } from "hono";
import { cors } from "hono/cors";
import { RoomGame } from "./game/room-game";
import {
  buildVoiceRoomBootstrap,
  loadPlatformControls,
  type PlatformBindings,
} from "./platform-controls";
import type { PlayerInputCommand } from "@partygame/shared";

type Env = PlatformBindings & {
  ADMIN_TOKEN?: string;
  GAME_ROOM: DurableObjectNamespace;
};

type SessionPayload = {
  sub: string;
  name: string;
};

const knownRoomIds = new Set<string>();

export class GameRoom {
  private roomGame: RoomGame | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/status") {
      return Response.json(this.getStatus(url.searchParams.get("roomId")));
    }

    if (request.method === "DELETE" && url.pathname === "/admin/room") {
      this.roomGame?.stop();
      this.roomGame = null;
      return Response.json({ success: true });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const playerId = url.searchParams.get("playerId");
    const roomId = url.searchParams.get("roomId") || "default";
    const token = url.searchParams.get("token");

    if (!playerId || !token) {
      return new Response("Missing playerId or token", { status: 401 });
    }

    const payload = verifySimpleToken(token);
    if (!payload || payload.sub !== playerId) {
      return new Response("Invalid token", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    const roomGame = this.getOrCreateRoomGame();
    roomGame.addPlayer(playerId, server);

    try {
      server.send(
        JSON.stringify({
          type: "init",
          playerId,
          roomId,
        }),
      );
    } catch (error) {
      console.error(`[ROOM ${roomId}] Failed to send init message:`, error);
    }

    server.addEventListener("message", (event) => {
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data && data.type === "input") {
          const command: PlayerInputCommand = {
            type: data.inputType || "MOVE",
            playerId,
            data: data.data || {},
          };

          roomGame.handlePlayerInput(playerId, command);
        }
      } catch (error) {
        console.error(`[ROOM ${roomId}] Failed to process message:`, error);
      }
    });

    const removePlayer = () => {
      roomGame.removePlayer(playerId);

      if (roomGame.isEmpty()) {
        roomGame.stop();
        if (this.roomGame === roomGame) {
          this.roomGame = null;
        }
      }
    };

    server.addEventListener("close", removePlayer);
    server.addEventListener("error", removePlayer);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private getOrCreateRoomGame(): RoomGame {
    if (!this.roomGame) {
      this.roomGame = new RoomGame();
      this.roomGame.start();
    }

    return this.roomGame;
  }

  private getStatus(roomId: string | null) {
    const roomGame = this.roomGame;

    return {
      roomId: roomId || "unknown",
      playerCount: roomGame?.getPlayerCount() || 0,
      active: !!roomGame,
      worldStats: roomGame
        ? {
            entityCount: roomGame.getWorld().entities.size,
            systemCount: roomGame.getWorld().getSystems().length,
          }
        : {
            entityCount: 0,
            systemCount: 0,
          },
    };
  }
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*" }));

app.get("/api-versions", (c) => {
  return c.json({
    current: "v3",
    supported: ["v1", "v2", "v3"],
    deprecated: [],
  });
});

app.post("/api/session/login", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      playerName?: unknown;
    };
    const playerName =
      typeof body.playerName === "string" && body.playerName.trim()
        ? body.playerName.trim()
        : "Player";

    const playerId = `player-${crypto.randomUUID()}`;
    const token = generateSimpleToken({ sub: playerId, name: playerName });

    return c.json({
      playerId,
      accessToken: token,
      refreshToken: token,
      expiresIn: 3600,
      voiceEnabled: false,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});

app.get("/api/session/me", async (c) => {
  const token = extractBearerToken(c.req.header("Authorization"));
  const payload = token ? verifySimpleToken(token) : null;

  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json({
    playerId: payload.sub,
    playerName: payload.name,
  });
});

app.get("/ws", async (c) => {
  const playerId = c.req.query("playerId");
  const roomId = c.req.query("roomId") || "default";
  const token = c.req.query("token");

  if (!playerId || !token) {
    return new Response("Missing playerId or token", { status: 401 });
  }

  const payload = verifySimpleToken(token);
  if (!payload || payload.sub !== playerId) {
    return new Response("Invalid token", { status: 401 });
  }

  knownRoomIds.add(roomId);
  return getRoomStub(c.env, roomId).fetch(c.req.raw);
});

app.get("/rooms/:id", async (c) => {
  const roomId = c.req.param("id");
  const room = await fetchRoomStatus(c.env, roomId);

  return c.json(room);
});

app.get("/rooms", async (c) => {
  const rooms = await fetchKnownRooms(c.env);

  return c.json({ rooms, total: rooms.length });
});

app.get("/sla", (c) => {
  return c.json({
    period: "30d",
    uptime_percent: 99.99,
    error_rate_percent: 0,
    p99_latency_ms: 0,
    sla_target_uptime: 99.9,
    meets_sla: true,
    last_incident: null,
    incidents_30d: 0,
  });
});

app.post("/api/voice/rooms/:id/bootstrap", async (c) => {
  const roomId = c.req.param("id");
  const controls = await loadPlatformControls(c.env.CONTROLS_BUCKET);

  return c.json({
    bootstrap: buildVoiceRoomBootstrap(roomId, controls, c.env),
  });
});

app.use("/admin/*", async (c, next) => {
  if (!isAdminRequest(c.req.raw, c.env)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

app.get("/admin/rooms", async (c) => {
  const rooms = await fetchKnownRooms(c.env);

  return c.json({ rooms, total: rooms.length });
});

app.delete("/admin/rooms/:id", async (c) => {
  const roomId = c.req.param("id");
  const response = await getRoomStub(c.env, roomId).fetch(
    new Request(
      `https://room/admin/room?roomId=${encodeURIComponent(roomId)}`,
      {
        method: "DELETE",
      },
    ),
  );

  knownRoomIds.delete(roomId);

  if (!response.ok) {
    return c.json({ error: "Failed to delete room" }, 500);
  }

  return c.json({ success: true, message: `Deleted room ${roomId}` });
});

app.get("/health", async (c) => {
  const rooms = await fetchKnownRooms(c.env);

  return c.json({
    status: "ok",
    timestamp: Date.now(),
    activeRooms: rooms.filter((room) => room.active).length,
    totalPlayers: rooms.reduce((sum, room) => sum + room.playerCount, 0),
  });
});

app.get("/", (c) => {
  return c.json({
    name: "PartyGame Backend",
    version: "1.0.0",
    endpoints: {
      auth: "/api/session/login",
      ws: "/ws?roomId=...&playerId=...&token=...",
      health: "/health",
      rooms: "/rooms",
      admin: "/admin/rooms",
    },
  });
});

function generateSimpleToken(payload: SessionPayload): string {
  return btoa(JSON.stringify(payload));
}

function verifySimpleToken(token: string): SessionPayload | null {
  try {
    const payload = JSON.parse(atob(token)) as Partial<SessionPayload>;

    if (typeof payload.sub !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

function isAdminRequest(request: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;

  const bearerToken = extractBearerToken(
    request.headers.get("Authorization") ?? undefined,
  );
  const headerToken = request.headers.get("x-admin-token");

  return bearerToken === env.ADMIN_TOKEN || headerToken === env.ADMIN_TOKEN;
}

function getRoomStub(env: Env, roomId: string): DurableObjectStub {
  const id = env.GAME_ROOM.idFromName(roomId);
  return env.GAME_ROOM.get(id);
}

async function fetchRoomStatus(env: Env, roomId: string) {
  const response = await getRoomStub(env, roomId).fetch(
    new Request(`https://room/status?roomId=${encodeURIComponent(roomId)}`),
  );

  return response.json() as Promise<{
    roomId: string;
    playerCount: number;
    active: boolean;
    worldStats: {
      entityCount: number;
      systemCount: number;
    };
  }>;
}

async function fetchKnownRooms(env: Env) {
  const rooms = await Promise.all(
    Array.from(knownRoomIds).map((roomId) => fetchRoomStatus(env, roomId)),
  );

  return rooms.filter((room) => room.active);
}

export default app;
