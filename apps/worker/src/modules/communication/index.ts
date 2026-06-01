import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

type RoomProxyBody = {
  roomId?: string;
};

function getRoomIdFromRequest(body: RoomProxyBody, fallback?: string): string | null {
  const candidate = body.roomId ?? fallback;
  if (!candidate || !candidate.trim()) return null;
  return candidate.trim();
}

async function proxyRoomRequest(
  c: any,
  roomId: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const namespace = c.env.GAME_ROOM as DurableObjectNamespace | undefined;
  if (!namespace) {
    return c.json({ error: "GAME_ROOM binding missing" }, 500);
  }
  const id = namespace.idFromName(roomId);
  const stub = namespace.get(id);
  return stub.fetch(`https://room.internal${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const communicationManifest: ModuleManifest = {
  id: "communication",
  name: "Communication",
  description: "Scope-based chat relay, presence tracking, and voice signalling.",
  icon: "ti-message-circle",
};

export const communicationModule: WorkerModule = {
  manifest: communicationManifest,
  init(app: Hono<any>) {
    app.use("/chat/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "textChat"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "textChat" }, 403);
      }
      await next();
    });

    app.use("/voice/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "voiceChat"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "voiceChat" }, 403);
      }
      await next();
    });

    app.post("/chat/join", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const roomId = getRoomIdFromRequest(body as RoomProxyBody);
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      return proxyRoomRequest(c, roomId, "/join", "POST", body);
    });

    app.post("/chat/leave", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const roomId = getRoomIdFromRequest(body as RoomProxyBody);
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      return proxyRoomRequest(c, roomId, "/leave", "POST", body);
    });

    app.post("/chat/message", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const roomId = getRoomIdFromRequest(body as RoomProxyBody);
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      return proxyRoomRequest(c, roomId, "/message", "POST", body);
    });

    app.get("/chat/log/:roomId", async (c) => {
      const roomId = getRoomIdFromRequest({}, c.req.param("roomId"));
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      const scope = c.req.query("scope");
      const suffix = scope ? `/log?scope=${encodeURIComponent(scope)}` : "/log";
      return proxyRoomRequest(c, roomId, suffix, "GET");
    });

    app.get("/chat/history/:roomId", async (c) => {
      const roomId = getRoomIdFromRequest({}, c.req.param("roomId"));
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      return proxyRoomRequest(c, roomId, "/history", "GET");
    });

    app.post("/voice/signal", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const roomId = getRoomIdFromRequest(body as RoomProxyBody);
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      return proxyRoomRequest(c, roomId, "/voice/signal", "POST", body);
    });

    app.get("/voice/log/:roomId", async (c) => {
      const roomId = getRoomIdFromRequest({}, c.req.param("roomId"));
      if (!roomId) return c.json({ error: "roomId is required" }, 400);
      return proxyRoomRequest(c, roomId, "/voice/log", "GET");
    });
  },
};
