// GuildRoom Durable Object

interface GuildMember {
  id: string;
  name: string;
  role: string;
}

interface ChatMessage {
  type: "chat";
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

const MEMBERS_KEY = "members";
const HISTORY_KEY = "history";
const MAX_HISTORY = 50;
const MAX_TEXT_LENGTH = 500;

export class GuildRoom implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── WebSocket upgrade ────────────────────────────────────────────────────
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // ── Member endpoints ─────────────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/join") {
      return this.handleJoin(request);
    }

    if (request.method === "POST" && url.pathname === "/leave") {
      return this.handleLeave(request);
    }
    
    if (request.method === "GET" && url.pathname === "/members") {
      const members = await this.readMembers();
      return new Response(JSON.stringify(members), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // ── Chat endpoints ───────────────────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/history") {
      const history = await this.readHistory();
      return new Response(JSON.stringify(history), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    
    if (request.method === "POST" && url.pathname === "/chat") {
      return this.handleRestChat(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  // ── Member Management ──────────────────────────────────────────────────────

  private async readMembers(): Promise<GuildMember[]> {
    const raw = await this.state.storage.get<GuildMember[]>(MEMBERS_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private async saveMembers(members: GuildMember[]): Promise<void> {
    await this.state.storage.put(MEMBERS_KEY, members);
  }

  private async handleJoin(request: Request): Promise<Response> {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    if (!body.id || !body.name || !body.role) {
      return new Response(JSON.stringify({ error: "Missing id, name, or role" }), { 
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const members = await this.readMembers();
    if (!members.find((m: GuildMember) => m.id === body.id)) {
      members.push({ id: String(body.id), name: String(body.name), role: String(body.role) });
      await this.saveMembers(members);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  private async handleLeave(request: Request): Promise<Response> {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    if (!body.id) {
      return new Response(JSON.stringify({ error: "Missing id" }), { 
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    let members = await this.readMembers();
    members = members.filter((m: GuildMember) => m.id !== body.id);
    await this.saveMembers(members);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  
  // ── Chat (REST) ────────────────────────────────────────────────────────────

  private async handleRestChat(request: Request): Promise<Response> {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { 
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    if (!body.playerId || !body.playerName || !body.text) {
      return new Response(JSON.stringify({ error: "Missing playerId, playerName, or text" }), { 
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
    
    await this.processAndBroadcastMessage({
      playerId: String(body.playerId),
      playerName: String(body.playerName)
    }, String(body.text));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // ── WebSocket Hibernation API handlers ───────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    const tags = this.state.getTags(ws);
    const playerId = tags[0] ?? "anon";
    const playerName = tags[1] ?? "Anonymous";

    let parsed: any;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (parsed.type !== "chat") return;
    
    const rawText = typeof parsed.text === "string" ? parsed.text : "";
    await this.processAndBroadcastMessage({ playerId, playerName }, rawText);
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string): Promise<void> {}
  
  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error("[GuildRoom] WebSocket error:", error);
  }

  // ── WebSocket handling ──────────────────────────────────────────────────────

  private handleWebSocketUpgrade(request: Request): Response {
    const url = new URL(request.url);

    const playerId = url.searchParams.get("playerId") ?? `anon-${crypto.randomUUID()}`;
    const playerName = url.searchParams.get("playerName") ?? "Anonymous";

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.state.acceptWebSocket(server, [playerId, playerName]);

    return new Response(null, { status: 101, webSocket: client });
  }

  private async processAndBroadcastMessage(
    session: { playerId: string; playerName: string },
    rawText: string
  ): Promise<void> {
    const sanitized = this.sanitizeText(rawText);
    if (sanitized.length === 0) return;

    const message: ChatMessage = {
      type: "chat",
      playerId: session.playerId,
      playerName: session.playerName,
      text: sanitized,
      timestamp: Date.now(),
    };

    await this.appendToHistory(message);

    const payload = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      } catch (err) {
        console.error("[GuildRoom] broadcast send error:", err);
      }
    }
  }

  // ── Storage helpers ─────────────────────────────────────────────────────────

  private async readHistory(): Promise<ChatMessage[]> {
    const raw = await this.state.storage.get<ChatMessage[]>(HISTORY_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  private async appendToHistory(message: ChatMessage): Promise<void> {
    const history = await this.readHistory();
    history.push(message);

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    await this.state.storage.put(HISTORY_KEY, history);
  }

  // ── Text sanitization ────────────────────────────────────────────────────────

  private sanitizeText(text: string): string {
    // eslint-disable-next-line no-control-regex
    const stripped = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    const trimmed = stripped.trim();

    if (trimmed.length === 0) return "";
    if (trimmed.length > MAX_TEXT_LENGTH) return trimmed.slice(0, MAX_TEXT_LENGTH);

    return trimmed;
  }
}
