import type { GameTickUpdate } from "@partygame/shared";

interface Session {
  playerId: string;
  ws: WebSocket;
  transform: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
  state?: any; // Game-specific state
}

interface GamePlugin {
  onJoin(session: Session): void;
  onInput(session: Session, inputType: string, data: any): void;
  onTick(sessions: Map<string, Session>): void;
}

// Simulated dynamic plugins (In a true micro-service architecture, these would be RPC calls to separate Workers)
class MobaPlugin implements GamePlugin {
  onJoin(session: Session) {}
  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "MOVE") {
      const moveX = Number(data?.moveX || 0);
      const moveY = Number(data?.moveY || 0);
      const speed = Boolean(data?.isSprinting) ? 2 : 1;
      session.transform.x += moveX * speed;
      session.transform.y += moveY * speed;
    }
  }
  onTick(sessions: Map<string, Session>) {
    // Basic MOBA logic (e.g. cooldowns, lane pressure) could go here
  }
}

class FpsPlugin implements GamePlugin {
  onJoin(session: Session) {}
  onInput(session: Session, inputType: string, data: any) {
    if (inputType === "MOVE") {
      const moveX = Number(data?.moveX || 0);
      const moveY = Number(data?.moveY || 0);
      // FPS movement might be faster or include Z-axis jumping
      session.transform.x += moveX * 3;
      session.transform.y += moveY * 3;
    }
  }
  onTick(sessions: Map<string, Session>) {}
}

export class GameRoom implements DurableObject {
  private sessions = new Map<string, Session>();
  private tick = 0;
  private interval: number | null = null;
  private env: any;
  private plugin: GamePlugin;

  constructor(private state: DurableObjectState, env: any) {
    this.env = env;
    // Default to MOBA if no gameType is specified yet
    this.plugin = new MobaPlugin();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const gameType = url.searchParams.get("gameType") || "moba";
    if (gameType === "fps") this.plugin = new FpsPlugin();
    else this.plugin = new MobaPlugin();

    const playerId = url.searchParams.get("playerId") || `anonymous-${crypto.randomUUID()}`;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSession(server, playerId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSession(ws: WebSocket, playerId: string) {
    ws.accept();

    const session: Session = {
      playerId,
      ws,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    };

    this.sessions.set(playerId, session);
    this.plugin.onJoin(session);

    ws.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        if (data.type === "input") {
          this.plugin.onInput(session, data.inputType, data.data);
        }
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(playerId);
      if (this.sessions.size === 0 && this.interval !== null) {
        clearInterval(this.interval as any);
        this.interval = null;
      }
    });

    ws.addEventListener("error", () => {
      this.sessions.delete(playerId);
    });

    ws.send(JSON.stringify({ type: "init", playerId }));

    if (this.interval === null) {
      this.startGameLoop();
    }
  }

  private startGameLoop() {
    this.interval = setInterval(() => {
      this.tick++;
      
      // Execute game-specific logic per tick
      this.plugin.onTick(this.sessions);

      const update: GameTickUpdate = {
        v: 1,
        tick: this.tick,
        timestamp: Date.now(),
        entities: {},
      };

      for (const [id, session] of this.sessions) {
        update.entities[id] = {
          transform: session.transform,
        };
      }

      const updateMsg = JSON.stringify(update);
      for (const session of this.sessions.values()) {
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(updateMsg);
        }
      }
    }, 50) as unknown as number; // 20 FPS
  }
}
