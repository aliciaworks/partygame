import type { GameTickUpdate, PlayerInputCommand } from "@partygame/shared";

type MessageHandler = (data: any) => void;

/**
 * Manages WebSocket communication with backend
 */
export class NetworkManager {
  private ws: WebSocket | null = null;
  private playerId: string = "";
  private token: string = "";
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private isConnecting = false;

  /**
   * Connect to backend server
   */
  async connect(playerName: string, backendUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isConnecting = true;

        // Normalize backend URL
        let wsUrl = backendUrl;
        if (!wsUrl.startsWith("http")) {
          wsUrl = `http://${wsUrl}`;
        }
        wsUrl = wsUrl.replace("http://", "ws://").replace("https://", "wss://");

        // Add /ws path if not present
        if (!wsUrl.includes("/ws")) {
          wsUrl = wsUrl.endsWith("/") ? wsUrl + "ws" : wsUrl + "/ws";
        }

        console.log(`Connecting to ${wsUrl}`);

        // First, authenticate to get a token
        const authUrl = backendUrl.replace("ws://", "http://").replace("wss://", "https://");
        const loginUrl = authUrl.endsWith("/")
          ? authUrl + "api/session/login"
          : authUrl + "/api/session/login";

        fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName }),
        })
          .then((res) => res.json())
          .then((data) => {
            this.playerId = data.playerId;
            this.token = data.accessToken;

            // Now connect via WebSocket
            const fullWsUrl = `${wsUrl}?roomId=default&playerId=${this.playerId}&token=${this.token}`;
            this.ws = new WebSocket(fullWsUrl);

            this.ws.onopen = () => {
              console.log("WebSocket connected");
              this.isConnecting = false;
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
              console.error("WebSocket error:", error);
              this.isConnecting = false;
              reject(error);
            };

            this.ws.onclose = () => {
              console.log("WebSocket disconnected");
              this.ws = null;
            };
          })
          .catch((error) => {
            this.isConnecting = false;
            reject(error);
          });
      } catch (error) {
        this.isConnecting = false;
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
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
      // Game tick update
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
