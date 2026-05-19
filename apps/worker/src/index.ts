import { Hono } from "hono";
import { cors } from "hono/cors";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { RoomGame } from "./room-game";
import type { PlayerInputCommand } from "@partygame/shared";

type Env = {
  DB?: any;
  GAME_ROOM?: any;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  R2?: any;
  CONTROLS_BUCKET?: any;
};

export class GameRoom {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response("GameRoom Durable Object is alive", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

// Game room storage - maps roomId to RoomGame instance
const gameRooms = new Map<string, RoomGame>();

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS middleware
app.use("*", cors({ origin: "*" }));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a simple token for demo purposes
 */
function generateSimpleToken(payload: any): string {
  return btoa(JSON.stringify(payload));
}

/**
 * Verify a simple token for demo purposes
 */
function verifySimpleToken(token: string): any {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

// ============================================================================
// ROUTES: Session / Auth
// ============================================================================

app.post("/api/session/login", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as any;
    const playerName = body.playerName || "Player";

    const playerId = `player-${crypto.randomUUID()}`;
    const payload = { sub: playerId, name: playerName };
    const token = generateSimpleToken(payload);

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
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifySimpleToken(token);

    if (!payload) {
      return c.json({ error: "Invalid token" }, 401);
    }

    return c.json({
      playerId: payload.sub,
      playerName: payload.name,
    });
  } catch (error) {
    console.error("Session error:", error);
    return c.json({ error: "Unauthorized" }, 401);
  }
});

// ============================================================================
// ROUTES: WebSocket Game Server
// ============================================================================

/**
 * WebSocket endpoint for real-time multiplayer game
 * Usage: ws://localhost:8787/ws?roomId=default&playerId=player-123&token=...
 */
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const playerId = c.req.query("playerId");
    const roomId = c.req.query("roomId") || "default";
    const token = c.req.query("token");

    if (!playerId || !token) {
      console.error("Missing playerId or token");
      return {
        onOpen() {},
        onMessage() {},
        onClose() {},
      };
    }

    // Verify token
    const payload = verifySimpleToken(token);
    if (!payload) {
      console.error("Invalid token");
      return {
        onOpen() {},
        onMessage() {},
        onClose() {},
      };
    }

    // Get or create room game
    let roomGame = gameRooms.get(roomId);
    if (!roomGame) {
      roomGame = new RoomGame();
      gameRooms.set(roomId, roomGame);
      roomGame.start();
      console.log(`[ROOM ${roomId}] Created and started game loop`);
    }

    // Get WebSocket from raw request
    const ws = c.req.raw.webSocket;

    // Add player to room
    roomGame.addPlayer(playerId, ws);

    return {
      onOpen() {
        console.log(`[ROOM ${roomId}] Player ${playerId} connected`);

        // Send init message to player
        try {
          ws.send(
            JSON.stringify({
              type: "init",
              playerId,
              roomId,
            }),
          );
        } catch (error) {
          console.error("Failed to send init message:", error);
        }
      },

      onMessage(message) {
        try {
          const data = JSON.parse(message);

          // Handle player input
          if (data.type === "input") {
            const command: PlayerInputCommand = {
              type: data.inputType || "MOVE",
              playerId,
              data: data.data || {},
            };

            roomGame!.handlePlayerInput(playerId, command);
          }
        } catch (error) {
          console.error(
            `[ROOM ${roomId}] Failed to process message:`,
            error,
          );
        }
      },

      onClose() {
        console.log(`[ROOM ${roomId}] Player ${playerId} disconnected`);

        roomGame?.removePlayer(playerId);

        // Clean up empty rooms
        if (roomGame?.isEmpty()) {
          roomGame.stop();
          gameRooms.delete(roomId);
          console.log(`[ROOM ${roomId}] Deleted empty room`);
        }
      },
    };
  }),
);

// ============================================================================
// ROUTES: Room Management
// ============================================================================

app.get("/rooms/:id", async (c) => {
  const roomId = c.req.param("id");

  try {
    const roomGame = gameRooms.get(roomId);

    return c.json({
      roomId,
      playerCount: roomGame?.getPlayerCount() || 0,
      active: !!roomGame,
    });
  } catch (error) {
    console.error("Room query error:", error);
    return c.json({ error: "Failed to query room" }, 500);
  }
});

app.get("/rooms", async (c) => {
  const rooms = Array.from(gameRooms.entries()).map(([roomId, game]) => ({
    roomId,
    playerCount: game.getPlayerCount(),
  }));

  return c.json({ rooms, total: rooms.length });
});

// ============================================================================
// ROUTES: Admin
// ============================================================================

app.get("/admin/rooms", async (c) => {
  const rooms = Array.from(gameRooms.entries()).map(([roomId, game]) => ({
    roomId,
    playerCount: game.getPlayerCount(),
    worldStats: {
      entityCount: game.getWorld().getEntityCount(),
      systemCount: game.getWorld().getSystemCount(),
    },
  }));

  return c.json({ rooms, total: rooms.length });
});

app.delete("/admin/rooms/:id", async (c) => {
  const roomId = c.req.param("id");
  const roomGame = gameRooms.get(roomId);

  if (!roomGame) {
    return c.json({ error: "Room not found" }, 404);
  }

  roomGame.stop();
  gameRooms.delete(roomId);

  return c.json({ success: true, message: `Deleted room ${roomId}` });
});

// ============================================================================
// ROUTES: Health / Status
// ============================================================================

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    activeRooms: gameRooms.size,
    totalPlayers: Array.from(gameRooms.values()).reduce(
      (sum, game) => sum + game.getPlayerCount(),
      0,
    ),
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

// ============================================================================
// EXPORT
// ============================================================================

export default app;

