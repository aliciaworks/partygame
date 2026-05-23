import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";

type PlayerPresence = {
  playerId: string;
  teamId?: string;
  squadId?: string;
  position?: { x: number; y: number };
  lastSeen: string;
};

type ChatMessage = {
  roomId: string;
  from: string;
  scope: string;
  content: string;
  ts: number;
  recipients: string[];
};

const ALLOWED_SCOPES = ["all", "team", "proximity", "squad", "admin"] as const;
const MESSAGE_HISTORY_COUNT = 50;
const RATE_LIMIT_PER_SEC = 5;
const PROXIMITY_RADIUS = 50;

const rooms = new Map<string, Map<string, PlayerPresence>>();
const histories = new Map<string, ChatMessage[]>();
const lastMessageAt = new Map<string, number[]>();

function roomMembers(roomId: string): Map<string, PlayerPresence> {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId)!;
}

function roomHistory(roomId: string): ChatMessage[] {
  if (!histories.has(roomId)) histories.set(roomId, []);
  return histories.get(roomId)!;
}

function isAllowedScope(scope: string): boolean {
  return ALLOWED_SCOPES.includes(scope as typeof ALLOWED_SCOPES[number]) || scope.startsWith("whisper:");
}

function sanitizeContent(content: string, profanityFilter: boolean): string {
  if (!profanityFilter) return content;
  return content.replace(/\b(fuck|shit|bitch)\b/gi, "***");
}

function distance(a?: { x: number; y: number }, b?: { x: number; y: number }): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function enforceRateLimit(playerId: string): boolean {
  const now = Date.now();
  const history = lastMessageAt.get(playerId) ?? [];
  const windowed = history.filter((stamp) => now - stamp < 1000);
  if (windowed.length >= RATE_LIMIT_PER_SEC) {
    lastMessageAt.set(playerId, windowed);
    return false;
  }

  windowed.push(now);
  lastMessageAt.set(playerId, windowed);
  return true;
}

function resolveRecipients(roomId: string, senderId: string, scope: string, targetPlayerId?: string): string[] {
  const members = roomMembers(roomId);
  const sender = members.get(senderId);
  if (!sender) return [];

  if (scope === "all") return Array.from(members.keys());
  if (scope === "team") return Array.from(members.entries()).filter(([, member]) => member.teamId && member.teamId === sender.teamId).map(([playerId]) => playerId);
  if (scope === "squad") return Array.from(members.entries()).filter(([, member]) => member.squadId && member.squadId === sender.squadId).map(([playerId]) => playerId);
  if (scope === "proximity") return Array.from(members.entries()).filter(([, member]) => distance(sender.position, member.position) <= PROXIMITY_RADIUS).map(([playerId]) => playerId);
  if (scope.startsWith("whisper:")) return targetPlayerId ? [targetPlayerId] : [scope.slice("whisper:".length)];
  return [];
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
    app.post("/chat/join", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        roomId?: string;
        playerId?: string;
        teamId?: string;
        squadId?: string;
        position?: { x?: number; y?: number };
      };

      if (!body.roomId || !body.playerId) {
        return c.json({ error: "roomId and playerId are required" }, 400);
      }

      roomMembers(body.roomId).set(body.playerId, {
        playerId: body.playerId,
        teamId: body.teamId,
        squadId: body.squadId,
        position: typeof body.position?.x === "number" && typeof body.position?.y === "number" ? { x: body.position.x, y: body.position.y } : undefined,
        lastSeen: new Date().toISOString(),
      });

      return c.json({ success: true, roomId: body.roomId });
    });

    app.post("/chat/leave", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { roomId?: string; playerId?: string };
      if (!body.roomId || !body.playerId) {
        return c.json({ error: "roomId and playerId are required" }, 400);
      }

      roomMembers(body.roomId).delete(body.playerId);
      return c.json({ success: true });
    });

    app.post("/chat/message", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        roomId?: string;
        playerId?: string;
        scope?: string;
        content?: string;
        targetPlayerId?: string;
        profanityFilter?: boolean;
      };

      if (!body.roomId || !body.playerId || !body.scope || typeof body.content !== "string") {
        return c.json({ error: "roomId, playerId, scope, and content are required" }, 400);
      }

      if (!isAllowedScope(body.scope)) {
        return c.json({ error: "SCOPE_NOT_PERMITTED" }, 403);
      }

      if (!enforceRateLimit(body.playerId)) {
        return c.json({ error: "RATE_LIMITED" }, 429);
      }

      const content = sanitizeContent(body.content, body.profanityFilter ?? true);
      const recipients = resolveRecipients(body.roomId, body.playerId, body.scope, body.targetPlayerId);
      const message: ChatMessage = {
        roomId: body.roomId,
        from: body.playerId,
        scope: body.scope,
        content,
        ts: Date.now(),
        recipients,
      };

      const history = roomHistory(body.roomId);
      history.push(message);
      while (history.length > MESSAGE_HISTORY_COUNT) history.shift();

      return c.json({ message });
    });

    app.get("/chat/log/:roomId", (c) => {
      const roomId = c.req.param("roomId");
      const scope = c.req.query("scope");
      const history = roomHistory(roomId);
      return c.json({ messages: scope ? history.filter((entry) => entry.scope === scope) : history });
    });

    app.get("/chat/history/:roomId", (c) => {
      const roomId = c.req.param("roomId");
      return c.json({ messages: roomHistory(roomId) });
    });

    app.post("/voice/signal", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { roomId?: string; from?: string; to?: string; sdp?: string };
      if (!body.roomId || !body.from || !body.to || typeof body.sdp !== "string") {
        return c.json({ error: "roomId, from, to, and sdp are required" }, 400);
      }

      return c.json({ type: "VOICE_SIGNAL", from: body.from, to: body.to, sdp: body.sdp, ts: Date.now() });
    });

    app.get("/voice/log/:roomId", (c) => {
      const roomId = c.req.param("roomId");
      const history = roomHistory(roomId).filter((entry) => entry.scope !== "admin");
      return c.json({ messages: history });
    });
  },
};
