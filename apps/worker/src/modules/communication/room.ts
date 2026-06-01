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

type VoiceSignal = {
  type: "VOICE_SIGNAL";
  from: string;
  to: string;
  sdp: string;
  ts: number;
};

const ALLOWED_SCOPES = ["all", "team", "proximity", "squad", "admin"] as const;
const MESSAGE_HISTORY_COUNT = 50;
const RATE_LIMIT_PER_SEC = 5;
const PROXIMITY_RADIUS = 50;

export class GameRoom implements DurableObject {
  private readonly members = new Map<string, PlayerPresence>();
  private readonly chatHistory: ChatMessage[] = [];
  private readonly voiceHistory: VoiceSignal[] = [];
  private readonly lastMessageAt = new Map<string, number[]>();

  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "POST" && path === "/join") return this.handleJoin(request);
    if (request.method === "POST" && path === "/leave") return this.handleLeave(request);
    if (request.method === "POST" && path === "/message") return this.handleMessage(request);
    if (request.method === "GET" && path === "/log") return this.handleLog(url.searchParams.get("scope"));
    if (request.method === "GET" && path === "/history") return this.json({ messages: this.chatHistory });
    if (request.method === "POST" && path === "/voice/signal") return this.handleVoiceSignal(request);
    if (request.method === "GET" && path === "/voice/log") return this.json({ messages: this.voiceHistory });
    return this.json({ error: "Not found" }, 404);
  }

  private async handleJoin(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      roomId?: string;
      playerId?: string;
      teamId?: string;
      squadId?: string;
      position?: { x?: number; y?: number };
    };
    if (!body.roomId || !body.playerId) {
      return this.json({ error: "roomId and playerId are required" }, 400);
    }
    this.members.set(body.playerId, {
      playerId: body.playerId,
      teamId: body.teamId,
      squadId: body.squadId,
      position:
        typeof body.position?.x === "number" && typeof body.position?.y === "number"
          ? { x: body.position.x, y: body.position.y }
          : undefined,
      lastSeen: new Date().toISOString(),
    });
    return this.json({ success: true, roomId: body.roomId });
  }

  private async handleLeave(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as { roomId?: string; playerId?: string };
    if (!body.roomId || !body.playerId) {
      return this.json({ error: "roomId and playerId are required" }, 400);
    }
    this.members.delete(body.playerId);
    this.lastMessageAt.delete(body.playerId);
    return this.json({ success: true });
  }

  private async handleMessage(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      roomId?: string;
      playerId?: string;
      scope?: string;
      content?: string;
      targetPlayerId?: string;
      profanityFilter?: boolean;
    };
    if (!body.roomId || !body.playerId || !body.scope || typeof body.content !== "string") {
      return this.json({ error: "roomId, playerId, scope, and content are required" }, 400);
    }
    if (!this.isAllowedScope(body.scope)) {
      return this.json({ error: "SCOPE_NOT_PERMITTED" }, 403);
    }
    if (!this.enforceRateLimit(body.playerId)) {
      return this.json({ error: "RATE_LIMITED" }, 429);
    }

    const content = this.sanitizeContent(body.content, body.profanityFilter ?? true);
    const recipients = this.resolveRecipients(body.playerId, body.scope, body.targetPlayerId);
    const message: ChatMessage = {
      roomId: body.roomId,
      from: body.playerId,
      scope: body.scope,
      content,
      ts: Date.now(),
      recipients,
    };
    this.chatHistory.push(message);
    while (this.chatHistory.length > MESSAGE_HISTORY_COUNT) this.chatHistory.shift();
    return this.json({ message });
  }

  private async handleVoiceSignal(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      roomId?: string;
      from?: string;
      to?: string;
      sdp?: string;
    };
    if (!body.roomId || !body.from || !body.to || typeof body.sdp !== "string") {
      return this.json({ error: "roomId, from, to, and sdp are required" }, 400);
    }
    const signal: VoiceSignal = {
      type: "VOICE_SIGNAL",
      from: body.from,
      to: body.to,
      sdp: body.sdp,
      ts: Date.now(),
    };
    this.voiceHistory.push(signal);
    while (this.voiceHistory.length > MESSAGE_HISTORY_COUNT) this.voiceHistory.shift();
    return this.json(signal);
  }

  private handleLog(scope?: string | null): Response {
    if (!scope) return this.json({ messages: this.chatHistory });
    return this.json({ messages: this.chatHistory.filter((entry) => entry.scope === scope) });
  }

  private isAllowedScope(scope: string): boolean {
    return ALLOWED_SCOPES.includes(scope as (typeof ALLOWED_SCOPES)[number]) || scope.startsWith("whisper:");
  }

  private sanitizeContent(content: string, profanityFilter: boolean): string {
    if (!profanityFilter) return content;
    return content.replace(/\b(fuck|shit|bitch)\b/gi, "***");
  }

  private distance(a?: { x: number; y: number }, b?: { x: number; y: number }): number {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private enforceRateLimit(playerId: string): boolean {
    const now = Date.now();
    const history = this.lastMessageAt.get(playerId) ?? [];
    const windowed = history.filter((stamp) => now - stamp < 1000);
    if (windowed.length >= RATE_LIMIT_PER_SEC) {
      this.lastMessageAt.set(playerId, windowed);
      return false;
    }
    windowed.push(now);
    this.lastMessageAt.set(playerId, windowed);
    return true;
  }

  private resolveRecipients(senderId: string, scope: string, targetPlayerId?: string): string[] {
    const sender = this.members.get(senderId);
    if (!sender) return [];

    if (scope === "all") return Array.from(this.members.keys());
    if (scope === "team") {
      return Array.from(this.members.entries())
        .filter(([, member]) => member.teamId && member.teamId === sender.teamId)
        .map(([playerId]) => playerId);
    }
    if (scope === "squad") {
      return Array.from(this.members.entries())
        .filter(([, member]) => member.squadId && member.squadId === sender.squadId)
        .map(([playerId]) => playerId);
    }
    if (scope === "proximity") {
      return Array.from(this.members.entries())
        .filter(([, member]) => this.distance(sender.position, member.position) <= PROXIMITY_RADIUS)
        .map(([playerId]) => playerId);
    }
    if (scope.startsWith("whisper:")) return targetPlayerId ? [targetPlayerId] : [scope.slice("whisper:".length)];
    return [];
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
