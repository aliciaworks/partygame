import type { GameTickUpdate, PlayerInputCommand } from "@partygame/shared";

type MessageHandler = (data: any) => void;

/**
 * Manages WebSocket communication with backend
 */
export class NetworkManager {
  private ws: WebSocket | null = null;
  private playerId = "";
  private token = "";
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private mode: "online" | "offline" = "offline";
  private offlineState = {
    tick: 0,
    x: 0,
    y: 0,
  };

  /**
   * Connect to backend server
   */
  async connect(playerName: string, backendUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Normalize backend URL
        let wsUrl = backendUrl;
        if (!wsUrl.startsWith("http")) {
          wsUrl = `http://${wsUrl}`;
        }
        wsUrl = wsUrl.replace("http://", "ws://").replace("https://", "wss://");

        if (!wsUrl.includes("/ws")) {
          wsUrl = wsUrl.endsWith("/") ? wsUrl + "ws" : wsUrl + "/ws";
        }

        console.log(`Connecting to ${wsUrl}`);

        const authUrl = backendUrl
          .replace("ws://", "http://")
          .replace("wss://", "https://");
        const loginUrl = authUrl.endsWith("/")
          ? authUrl + "auth/login"
          : authUrl + "/auth/login";

        fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName }),
        })
          .then((res) => res.json())
          .then((data) => {
            this.playerId = data.playerId;
            this.token = data.token ?? data.accessToken ?? "";

            if (!this.playerId || !this.token) {
              throw new Error("Authentication failed");
            }

            const fullWsUrl = `${wsUrl}?roomId=default&playerId=${this.playerId}&token=${this.token}`;
            this.ws = new WebSocket(fullWsUrl);

            const timeout = window.setTimeout(() => {
              if (!this.ws || this.ws.readyState !== WebSocket.CONNECTING) {
                return;
              }

              this.ws.close();
              this.ws = null;
              this.mode = "offline";
              this.messageHandlers.get("init")?.({
                playerId: this.playerId,
                roomId: "offline",
              });
              resolve();
            }, 1500);

            this.ws.onopen = () => {
              window.clearTimeout(timeout);
              this.mode = "online";
              console.log("WebSocket connected");
              resolve();
            };

            this.ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
              } catch (error) {
                console.error("Failed to parse message:", error);
              }
            };

            this.ws.onerror = (error) => {
              window.clearTimeout(timeout);
              console.error("WebSocket error:", error);
              this.mode = "offline";
              this.ws = null;
              this.messageHandlers.get("init")?.({
                playerId: this.playerId,
                roomId: "offline",
              });
              resolve();
            };

            this.ws.onclose = () => {
              window.clearTimeout(timeout);
              console.log("WebSocket disconnected");
              this.ws = null;
            };
          })
          .catch((error) => {
            console.warn("Falling back to offline mode:", error);
            this.mode = "offline";
            this.playerId = `offline-${crypto.randomUUID()}`;
            this.token = "";
            this.messageHandlers.get("init")?.({
              playerId: this.playerId,
              roomId: "offline",
            });
            resolve();
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.mode = "offline";
  }

  /**
   * Send player input
   */
  sendInput(
    moveX: number,
    moveY: number,
    isSprinting: boolean,
    isJumping: boolean,
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.mode === "offline") {
      this.offlineState.tick += 1;
      this.offlineState.x += moveX * (isSprinting ? 2 : 1);
      this.offlineState.y += moveY * (isSprinting ? 2 : 1);

      this.messageHandlers.get("tick")?.({
        v: 1,
        tick: this.offlineState.tick,
        timestamp: Date.now(),
        entities: {
          [this.playerId]: {
            transform: {
              x: this.offlineState.x,
              y: this.offlineState.y,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
            },
          },
        },
      } as GameTickUpdate);

      return;
    }

    const command: PlayerInputCommand = {
      type: "MOVE",
      playerId: this.playerId,
      data: {
        moveX,
        moveY,
        isSprinting,
        isJumping,
      },
    };

    this.ws.send(
      JSON.stringify({
        type: "input",
        inputType: "MOVE",
        data: command.data,
      }),
    );
  }

  /**
   * Register message handler for specific message type
   */
  onMessage(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: any): void {
    if (data.type === "init") {
      console.log(`Initialized in room with player ID: ${data.playerId}`);
      this.messageHandlers.get("init")?.(data);
    } else if (data.tick !== undefined) {
      const update: GameTickUpdate = data;
      this.messageHandlers.get("tick")?.(update);
    } else {
      console.warn("Unknown message type:", data);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get player ID
   */
  getPlayerId(): string {
    return this.playerId;
  }
}
