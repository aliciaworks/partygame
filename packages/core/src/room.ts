import { Server } from "partyserver";
import type { Connection } from "partyserver";

// --- Game Types ---

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  position: Vector2;
  lastUpdated: number;
}

export interface RoomState {
  players: Record<string, PlayerState>;
}

export interface MovePayload {
  x: number;
  y: number;
}

export interface ClientMessage {
  type: "MOVE";
  payload: MovePayload;
}

// --- Configuration ---

const TICK_RATE_HZ = 20;
const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ; // 50ms
const MAX_SPEED_PER_TICK = 10.0; // Maximum allowed distance a player can travel in one tick

/**
 * The core authoritative GameRoom built on Cloudflare Durable Objects.
 */
export class GameRoom extends Server {
  private state: RoomState = { players: {} };
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private pendingMutations = false;

  /**
   * Called when the Durable Object starts up.
   */
  async onStart() {
    // Start the fixed tick-rate loop
    this.startGameLoop();
  }

  /**
   * Called when a new WebSocket connection is established.
   */
  onConnect(connection: Connection) {
    // Initialize player state
    this.state.players[connection.id] = {
      id: connection.id,
      position: { x: 0, y: 0 },
      lastUpdated: Date.now(),
    };
    this.pendingMutations = true;
    
    // Welcome the new player with the initial state
    connection.send(JSON.stringify({ type: "INIT_STATE", payload: this.state }));
  }

  /**
   * Called when a client disconnects.
   */
  onClose(connection: Connection) {
    delete this.state.players[connection.id];
    this.pendingMutations = true;
  }

  /**
   * Intercepts and processes inbound messages from clients.
   */
  onMessage(connection: Connection, message: string | ArrayBuffer) {
    try {
      // In a production scenario, you would handle ArrayBuffer for Protobuf.
      // For this implementation, we assume JSON serialization over strings.
      if (typeof message !== "string") return;

      const parsedMessage = JSON.parse(message) as ClientMessage;

      if (parsedMessage.type === "MOVE") {
        this.handlePlayerMove(connection, parsedMessage.payload);
      }
    } catch (error) {
      console.error("Failed to parse incoming message:", error);
    }
  }

  /**
   * Anti-Cheat Hook: Validates movement against a maximum allowed speed.
   */
  private handlePlayerMove(connection: Connection, payload: MovePayload) {
    const player = this.state.players[connection.id];
    if (!player) return;

    const currentPos = player.position;
    const targetPos = payload;

    // Calculate distance squared (more efficient than full distance with Math.sqrt)
    const dx = targetPos.x - currentPos.x;
    const dy = targetPos.y - currentPos.y;
    const distanceSq = dx * dx + dy * dy;

    // Validate distance against our MAX_SPEED
    if (distanceSq > MAX_SPEED_PER_TICK * MAX_SPEED_PER_TICK) {
      // Cheat detected or lag spike: Reject mutation and rubberband the client
      console.warn(`[Anti-Cheat] Player ${connection.id} moved too fast. Rubberbanding.`);
      connection.send(JSON.stringify({
        type: "RUBBERBAND",
        payload: { position: currentPos }
      }));
      return;
    }

    // Valid move: Update state
    player.position = { x: targetPos.x, y: targetPos.y };
    player.lastUpdated = Date.now();
    this.pendingMutations = true;
  }

  /**
   * The fixed tick-rate server loop.
   */
  private startGameLoop() {
    if (this.tickInterval) return;

    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  /**
   * Executes once per tick. Broadcasts state snapshots if mutations occurred.
   */
  private tick() {
    // Only broadcast if the state has changed to save bandwidth
    if (!this.pendingMutations) return;

    const snapshotMessage = JSON.stringify({
      type: "ROOM_STATE",
      payload: this.state
    });

    // Broadcast absolute state snapshot to all connected clients
    this.broadcast(snapshotMessage);
    
    // Reset mutations flag
    this.pendingMutations = false;
  }
}
