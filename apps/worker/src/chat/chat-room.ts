// ChatRoom Durable Object — uses WebSocket Hibernation API so the DO
// hibernates between messages and is only billed for active CPU time.

/** A single chat message stored in DO persistent storage. */
interface ChatMessage {
  type: "chat";
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

/** Maximum number of messages retained in persistent history. */
const MAX_HISTORY = 50;

/** Maximum permitted length of a single chat message text. */
const MAX_TEXT_LENGTH = 500;

/** Storage key for the message history array. */
const HISTORY_KEY = "history";

/**
 * ChatRoom is a Durable Object that maintains a live WebSocket room for
 * text chat. Uses the Hibernation API so the DO sleeps when no messages
 * are being sent, eliminating idle CPU charges.
 *
 * Supported endpoints:
 *  WS  *          — WebSocket upgrade (any path); joins the chat room
 *  GET /history   — Returns the last 50 messages as JSON
 *  POST *         — Non-WS HTTP: handles { type: 'ping' } → { type: 'pong' }
 */
export class ChatRoom implements DurableObject {
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

    // ── HTTP GET /history ────────────────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/history") {
      return this.handleHistoryRequest();
    }

    // ── HTTP POST — simple ping/pong health check ─────────────────────────────
    if (request.method === "POST") {
      return this.handlePostRequest(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  // ── WebSocket Hibernation API handlers ───────────────────────────────────────

  /** Called by the runtime when a hibernated WebSocket receives a message. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    // Retrieve player identity stored as WS tags at connection time
    const tags = this.state.getTags(ws);
    const playerId = tags[0] ?? "anon";
    const playerName = tags[1] ?? "Anonymous";

    await this.handleMessage({ ws, playerId, playerName }, message);
  }

  /** Called by the runtime when a hibernated WebSocket closes. */
  async webSocketClose(_ws: WebSocket, _code: number, _reason: string): Promise<void> {
    // Nothing to clean up — Hibernation API manages WebSocket lifecycle
  }

  /** Called by the runtime when a hibernated WebSocket errors. */
  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error("[ChatRoom] WebSocket error:", error);
  }

  // ── WebSocket handling ──────────────────────────────────────────────────────

  /**
   * Upgrades an HTTP request to a WebSocket connection using the
   * Hibernation API (state.acceptWebSocket). Player identity is stored
   * as WebSocket tags and survives DO hibernation.
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const url = new URL(request.url);

    const playerId = url.searchParams.get("playerId") ?? `anon-${crypto.randomUUID()}`;
    const playerName = url.searchParams.get("playerName") ?? "Anonymous";

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Store player identity as tags — these survive hibernation
    this.state.acceptWebSocket(server, [playerId, playerName]);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Parses, validates, stores and broadcasts an incoming chat message. */
  private async handleMessage(
    session: { ws: WebSocket; playerId: string; playerName: string },
    raw: string,
  ): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const data = parsed as Record<string, unknown>;
    if (data.type !== "chat") return;

    const playerId =
      typeof data.playerId === "string" ? data.playerId : session.playerId;
    const playerName =
      typeof data.playerName === "string" ? data.playerName : session.playerName;

    const rawText = typeof data.text === "string" ? data.text : "";
    const sanitized = this.sanitizeText(rawText);
    if (sanitized.length === 0) return;

    const message: ChatMessage = {
      type: "chat",
      playerId,
      playerName,
      text: sanitized,
      timestamp: Date.now(),
    };

    // Persist to storage before broadcasting
    await this.appendToHistory(message);

    // Broadcast to every connected WebSocket via Hibernation API
    const payload = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      } catch (err) {
        console.error("[ChatRoom] broadcast send error:", err);
      }
    }
  }

  // ── HTTP handlers ──────────────────────────────────────────────────────────

  private async handleHistoryRequest(): Promise<Response> {
    const history = await this.readHistory();
    return new Response(JSON.stringify(history), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  private async handlePostRequest(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const data = body as Record<string, unknown>;
    if (data.type === "ping") {
      return new Response(JSON.stringify({ type: "pong" }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown request type" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
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
