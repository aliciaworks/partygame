import type { GameTickUpdate } from "@partygame/shared";
import type { GamePlugin, Session } from "./plugin";
import { getGamePlugin } from "../plugins/registry";
import { encode, decode } from "@msgpack/msgpack";

// ---------------------------------------------------------------------------
// GameRoom Durable Object — uses the WebSocket Hibernation API so that
// the DO is only billed while actively processing messages, not while
// clients are idle between game ticks.
// ---------------------------------------------------------------------------
export class GameRoom implements DurableObject {
  private tick = 0;
  private interval: number | null = null;
  private env: any;
  private plugin: GamePlugin;

  constructor(private state: DurableObjectState, env: any) {
    this.env = env;
    this.plugin = getGamePlugin("moba");
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const gameType = url.searchParams.get("gameType") || "moba";
    this.plugin = getGamePlugin(gameType);

    const playerId = url.searchParams.get("playerId") || `anonymous-${crypto.randomUUID()}`;

    // Use the Hibernation API: acceptWebSocket() instead of ws.accept()
    // This allows the DO to hibernate between messages — zero cost when idle
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Attach metadata so we can recover session info after hibernation wakes the DO
    this.state.acceptWebSocket(server, [playerId, gameType]);

    // Initialize plugin state for this player immediately
    const session = this.getOrCreateSession(server, playerId);
    this.plugin.onJoin(session);
    server.send(encode({ type: "init", playerId }));

    if (this.env.ANALYTICS) {
      this.env.ANALYTICS.writeDataPoint({
        blobs: ["game_connected", playerId, gameType],
        doubles: [1],
      });
    }

    // Only start the game loop when the plugin requires ticking
    if (this.interval === null && this.plugin.tickIntervalMs > 0) {
      this.startGameLoop();
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------------------------------------------------------------------------
  // Hibernation API handlers — called by the runtime after the DO wakes
  // ---------------------------------------------------------------------------

  /** Called by the runtime when a hibernated WebSocket receives a message. */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const tags = this.state.getTags(ws);
    const playerId = tags[0] ?? "unknown";
    const session = this.getOrCreateSession(ws, playerId);

    try {
      if (message instanceof ArrayBuffer) {
        try {
          // Try to decode as MessagePack first
          const parsed = decode(new Uint8Array(message)) as any;
          if (parsed && parsed.type === "input") {
            this.plugin.onInput(session, parsed.inputType, parsed.data);
            this.flushBroadcasts();
            return;
          }
        } catch (err) {
          // Fallback to pure binary payload for custom C++/C# binary handlers
        }

        if (this.plugin.onBinaryInput) {
          this.plugin.onBinaryInput(session, message);
          this.flushBroadcasts();
        }
        return;
      }

      const parsed = JSON.parse(message);
      if (parsed.type === "input") {
        this.plugin.onInput(session, parsed.inputType, parsed.data);
        this.flushBroadcasts();
      }
    } catch (err) {
      console.error("Failed to parse message", err);
    }
  }

  /** Called by the runtime when a hibernated WebSocket closes. */
  async webSocketClose(ws: WebSocket, _code: number, _reason: string): Promise<void> {
    const tags = this.state.getTags(ws);
    const playerId = tags[0];
    const gameType = tags[1] || "moba";

    if (playerId) {
      if (this.env.ANALYTICS) {
        this.env.ANALYTICS.writeDataPoint({
          blobs: ["game_disconnected", playerId, gameType],
          doubles: [1],
        });
      }

      this.state.getWebSockets().forEach(() => {}); // ensure state is current
      if (this.interval !== null && this.state.getWebSockets().length === 0) {
        clearInterval(this.interval as any);
        this.interval = null;
      }
    }
  }

  /** Called by the runtime when a hibernated WebSocket errors. */
  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const tags = this.state.getTags(ws);
    const playerId = tags[0];
    if (playerId) console.error(`[GameRoom] WebSocket error for player ${playerId}`);
  }

  // ---------------------------------------------------------------------------
  // Session management — reconstructed from WebSocket tags after hibernation
  // ---------------------------------------------------------------------------

  /**
   * Reconstruct or create a Session object from an accepted WebSocket.
   * Since the DO can hibernate, we cannot store sessions in a Map across
   * cold wakes. We store minimal transform state in the WS attachment instead.
   */
  private getOrCreateSession(ws: WebSocket, playerId: string): Session {
    // Try to retrieve existing transform from WS deserialized state
    const attachment = ws.deserializeAttachment() as {
      transform?: Session["transform"];
      state?: any;
    } | null;

    return {
      playerId,
      ws,
      transform: attachment?.transform ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      state: attachment?.state ?? undefined,
    };
  }

  /** Persist session state into the WebSocket attachment for survival across hibernation. */
  private persistSession(session: Session): void {
    session.ws.serializeAttachment({
      transform: session.transform,
      state: session.state,
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast helpers
  // ---------------------------------------------------------------------------

  /**
   * Flush pending broadcast messages that plugins placed in
   * session.state._broadcasts during onInput. Then persist the session.
   */
  private flushBroadcasts() {
    // Iterate all currently-active WebSockets managed by the Hibernation API
    for (const ws of this.state.getWebSockets()) {
      const tags = this.state.getTags(ws);
      const playerId = tags[0] ?? "unknown";
      const attachment = ws.deserializeAttachment() as any;
      const broadcasts: Array<{ exclude: string; message: string }> =
        attachment?.state?._broadcasts ?? [];

      if (broadcasts.length === 0) continue;

      for (const { exclude, message } of broadcasts) {
        // Intercept match-ending events and enqueue for background processing
        if (message.includes('"race_finish"')) {
          try {
            if (this.env.MATCH_QUEUE) {
              this.env.MATCH_QUEUE.send({
                type: "MATCH_END",
                matchId: "room-" + Date.now(),
                players: this.state.getWebSockets().map((w) => this.state.getTags(w)[0]),
                winnerId: playerId,
                timestamp: Date.now(),
              });
            }
          } catch (e) {
            console.error("Failed to enqueue match stats", e);
          }
        }

        for (const target of this.state.getWebSockets()) {
          const targetId = this.state.getTags(target)[0];
          if (targetId === exclude) continue;
          if (target.readyState === WebSocket.OPEN) {
            target.send(message);
          }
        }
      }

      // Clear broadcast queue and persist updated attachment
      if (attachment?.state) {
        attachment.state._broadcasts = [];
        ws.serializeAttachment(attachment);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------

  private startGameLoop() {
    const pluginTickMs = this.plugin.tickIntervalMs;
    if (pluginTickMs <= 0) return;

    this.interval = setInterval(() => {
      this.tick++;

      // Rebuild the sessions map from active WebSockets for this tick
      const sessions = new Map<string, Session>();
      for (const ws of this.state.getWebSockets()) {
        const tags = this.state.getTags(ws);
        const playerId = tags[0] ?? "unknown";
        sessions.set(playerId, this.getOrCreateSession(ws, playerId));
      }

      if (sessions.size === 0) {
        clearInterval(this.interval as any);
        this.interval = null;
        return;
      }

      this.plugin.onTick(sessions);

      const update: GameTickUpdate = {
        v: 1,
        tick: this.tick,
        timestamp: Date.now(),
        entities: {},
      };

      for (const [id, session] of sessions) {
        const entityData: any = { transform: session.transform };

        if (session.state) {
          for (const key of Object.keys(session.state)) {
            if (key !== "_broadcasts") {
              entityData[key] = session.state[key];
            }
          }
        }

        if (session.state?.__zoneTick) {
          (update.entities as any)["__zone"] = session.state.__zoneTick;
        }

        update.entities[id] = entityData;

        // Persist updated state back into the WS attachment
        this.persistSession(session);
      }

      const updateMsg = encode(update);
      for (const ws of this.state.getWebSockets()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(updateMsg);
        }
      }
    }, pluginTickMs) as unknown as number;
  }
}
