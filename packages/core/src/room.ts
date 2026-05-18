import { Server } from "partyserver";
import type { Connection } from "partyserver";
import {
  CLIENT_TIMEOUT_MS,
  MAX_SPEED_PER_TICK,
  TICK_INTERVAL_MS,
  createPlayerState,
  isMoveWithinBounds,
  isPlayerTimedOut,
  normalizeMovePayload,
  parseClientMessage,
  type RoomState,
} from "./room-logic";

/**
 * The core authoritative GameRoom built on Cloudflare Durable Objects.
 */
export class GameRoom extends Server<any> {
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
    this.state.players[connection.id] = createPlayerState(connection.id);
    this.pendingMutations = true;

    // Welcome the new player with the initial state
    connection.send(
      JSON.stringify({ type: "INIT_STATE", payload: this.state }),
    );
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
    if (typeof message !== "string") {
      return;
    }

    const parsedMessage = parseClientMessage(message);

    if (!parsedMessage) {
      console.warn(`[Protocol] Ignoring invalid message from ${connection.id}`);
      return;
    }

    if (parsedMessage.type === "MOVE") {
      this.handlePlayerMove(connection, parsedMessage.payload);
    } else if (parsedMessage.type === "PING") {
      this.handlePing(connection);
    }
  }

  /**
   * Keep-Alive hook: Responds to client pings.
   */
  private handlePing(connection: Connection) {
    const player = this.state.players[connection.id];
    if (player) {
      player.lastPing = Date.now();
    }
    connection.send(
      JSON.stringify({ type: "PONG", payload: { serverTime: Date.now() } }),
    );
  }

  /**
   * Anti-Cheat Hook: Validates movement against a maximum allowed speed.
   */
  private handlePlayerMove(connection: Connection, payload: unknown) {
    const player = this.state.players[connection.id];
    if (!player) return;

    const targetPos = normalizeMovePayload(payload);
    if (!targetPos) {
      connection.send(
        JSON.stringify({
          type: "INVALID_MOVE",
          payload: { reason: "Malformed payload" },
        }),
      );
      return;
    }

    const currentPos = player.position;

    // Validate distance against our MAX_SPEED
    if (!isMoveWithinBounds(currentPos, targetPos, MAX_SPEED_PER_TICK)) {
      // Cheat detected or lag spike: Reject mutation and rubberband the client
      console.warn(
        `[Anti-Cheat] Player ${connection.id} moved too fast. Rubberbanding.`,
      );
      connection.send(
        JSON.stringify({
          type: "RUBBERBAND",
          payload: { position: currentPos },
        }),
      );
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
    const now = Date.now();
    let hasStalePlayers = false;

    // Check for stale connections (Timeout)
    for (const [id, player] of Object.entries(this.state.players)) {
      if (isPlayerTimedOut(player.lastPing, now, CLIENT_TIMEOUT_MS)) {
        console.log(`[Timeout] Disconnecting stale player ${id}`);
        const connection = this.getConnection(id);
        if (connection) {
          connection.close(1000, "Timeout");
        }
        delete this.state.players[id];
        hasStalePlayers = true;
      }
    }

    if (hasStalePlayers) {
      this.pendingMutations = true;
    }

    // Only broadcast if the state has changed to save bandwidth
    if (!this.pendingMutations) return;

    const snapshotMessage = JSON.stringify({
      type: "ROOM_STATE",
      payload: this.state,
    });

    // Broadcast absolute state snapshot to all connected clients
    this.broadcast(snapshotMessage);

    // Reset mutations flag
    this.pendingMutations = false;
  }
}
