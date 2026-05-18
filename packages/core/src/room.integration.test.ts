import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Integration tests for complete room lifecycle.
 * Tests: room creation, player join, move, validation, disconnect, state sync.
 */

interface TestRoom {
  id: string;
  players: Map<string, TestPlayer>;
  state: any;
  tick: number;
}

interface TestPlayer {
  id: string;
  position: { x: number; y: number };
  lastUpdated: number;
  lastPing: number;
}

// Simulated room management for testing
class TestGameRoom {
  private rooms: Map<string, TestRoom> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;

  createRoom(roomId: string) {
    const room: TestRoom = {
      id: roomId,
      players: new Map(),
      state: { activePlayers: 0 },
      tick: 0,
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoomOrCreate(roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.createRoom(roomId);
    }
    return this.rooms.get(roomId)!;
  }

  addPlayerToRoom(roomId: string, playerId: string) {
    const room = this.getRoomOrCreate(roomId);
    if (room.players.has(playerId)) {
      throw new Error(`Player ${playerId} already in room`);
    }

    const player: TestPlayer = {
      id: playerId,
      position: { x: 0, y: 0 },
      lastUpdated: Date.now(),
      lastPing: Date.now(),
    };

    room.players.set(playerId, player);
    room.state.activePlayers = room.players.size;
    return player;
  }

  movePlayer(roomId: string, playerId: string, x: number, y: number) {
    const room = this.getRoomOrCreate(roomId);
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not in room`);
    }

    // Simple bounds check: -10 to 10
    if (x < -10 || x > 10 || y < -10 || y > 10) {
      return { valid: false, reason: "Out of bounds" };
    }

    player.position = { x, y };
    player.lastUpdated = Date.now();
    return { valid: true };
  }

  removePlayerFromRoom(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (!room.players.has(playerId)) {
      throw new Error(`Player ${playerId} not in room`);
    }

    room.players.delete(playerId);
    room.state.activePlayers = room.players.size;

    // Clean up empty room
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  getRoomState(roomId: string) {
    return this.rooms.get(roomId);
  }

  startTicking(roomId: string, intervalMs: number = 50) {
    const room = this.getRoomOrCreate(roomId);
    this.tickInterval = setInterval(() => {
      room.tick++;
    }, intervalMs);
  }

  stopTicking() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  cleanup() {
    this.stopTicking();
    this.rooms.clear();
  }
}

describe("Room Lifecycle Integration Tests", () => {
  let gameRoom: TestGameRoom;

  beforeEach(() => {
    gameRoom = new TestGameRoom();
  });

  afterEach(() => {
    gameRoom.cleanup();
  });

  describe("room creation and player join", () => {
    it("creates a new room", () => {
      const room = gameRoom.createRoom("room-1");
      expect(room.id).toBe("room-1");
      expect(room.players.size).toBe(0);
      expect(room.state.activePlayers).toBe(0);
    });

    it("adds a player to room", () => {
      gameRoom.createRoom("room-1");
      const player = gameRoom.addPlayerToRoom("room-1", "player-1");

      const room = gameRoom.getRoomState("room-1");
      expect(room?.players.size).toBe(1);
      expect(room?.state.activePlayers).toBe(1);
      expect(player.id).toBe("player-1");
      expect(player.position).toEqual({ x: 0, y: 0 });
    });

    it("prevents duplicate player in same room", () => {
      gameRoom.createRoom("room-1");
      gameRoom.addPlayerToRoom("room-1", "player-1");

      expect(() => {
        gameRoom.addPlayerToRoom("room-1", "player-1");
      }).toThrow("already in room");
    });

    it("adds multiple players to room", () => {
      gameRoom.createRoom("room-1");
      gameRoom.addPlayerToRoom("room-1", "player-1");
      gameRoom.addPlayerToRoom("room-1", "player-2");
      gameRoom.addPlayerToRoom("room-1", "player-3");

      const room = gameRoom.getRoomState("room-1");
      expect(room?.players.size).toBe(3);
    });
  });

  describe("player movement and validation", () => {
    beforeEach(() => {
      gameRoom.createRoom("room-1");
      gameRoom.addPlayerToRoom("room-1", "player-1");
    });

    it("moves player within bounds", () => {
      const result = gameRoom.movePlayer("room-1", "player-1", 5, 3);
      expect(result.valid).toBe(true);

      const room = gameRoom.getRoomState("room-1");
      const player = room?.players.get("player-1");
      expect(player?.position).toEqual({ x: 5, y: 3 });
    });

    it("rejects movement out of bounds", () => {
      const result = gameRoom.movePlayer("room-1", "player-1", 15, 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Out of bounds");

      // Verify position unchanged
      const room = gameRoom.getRoomState("room-1");
      const player = room?.players.get("player-1");
      expect(player?.position).toEqual({ x: 0, y: 0 });
    });

    it("allows edge-case movements", () => {
      const result1 = gameRoom.movePlayer("room-1", "player-1", -10, -10);
      const result2 = gameRoom.movePlayer("room-1", "player-1", 10, 10);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it("updates lastUpdated timestamp on move", () => {
      const room1 = gameRoom.getRoomState("room-1");
      const oldTime = room1?.players.get("player-1")?.lastUpdated;

      // Small delay to ensure timestamp changes
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Busy wait for test timing
      }

      gameRoom.movePlayer("room-1", "player-1", 2, 2);

      const room2 = gameRoom.getRoomState("room-1");
      const newTime = room2?.players.get("player-1")?.lastUpdated;

      expect(newTime).toBeGreaterThan(oldTime!);
    });
  });

  describe("player disconnect", () => {
    beforeEach(() => {
      gameRoom.createRoom("room-1");
      gameRoom.addPlayerToRoom("room-1", "player-1");
      gameRoom.addPlayerToRoom("room-1", "player-2");
    });

    it("removes player from room", () => {
      gameRoom.removePlayerFromRoom("room-1", "player-1");

      const room = gameRoom.getRoomState("room-1");
      expect(room?.players.size).toBe(1);
      expect(room?.state.activePlayers).toBe(1);
    });

    it("cleans up empty room", () => {
      gameRoom.removePlayerFromRoom("room-1", "player-1");
      gameRoom.removePlayerFromRoom("room-1", "player-2");

      // Room should be deleted after all players leave
      const room = gameRoom.getRoomState("room-1");
      expect(room).toBeUndefined();
    });

    it("prevents removing non-existent player", () => {
      expect(() => {
        gameRoom.removePlayerFromRoom("room-1", "player-999");
      }).toThrow("not in room");
    });
  });

  describe("tick and state synchronization", () => {
    it("increments tick counter", async () => {
      gameRoom.createRoom("room-1");
      gameRoom.startTicking("room-1", 10);

      const room1 = gameRoom.getRoomState("room-1");
      const tick1 = room1?.tick || 0;

      await new Promise((resolve) => setTimeout(resolve, 30));

      const room2 = gameRoom.getRoomState("room-1");
      const tick2 = room2?.tick || 0;

      expect(tick2).toBeGreaterThan(tick1);
    });

    it("maintains room state across operations", () => {
      gameRoom.createRoom("room-1");
      gameRoom.addPlayerToRoom("room-1", "player-1");
      gameRoom.addPlayerToRoom("room-1", "player-2");

      gameRoom.movePlayer("room-1", "player-1", 3, 4);
      gameRoom.movePlayer("room-1", "player-2", -2, 5);

      const room = gameRoom.getRoomState("room-1");
      const p1 = room?.players.get("player-1");
      const p2 = room?.players.get("player-2");

      expect(p1?.position).toEqual({ x: 3, y: 4 });
      expect(p2?.position).toEqual({ x: -2, y: 5 });
      expect(room?.state.activePlayers).toBe(2);
    });
  });

  describe("multi-room isolation", () => {
    it("keeps room state isolated", () => {
      gameRoom.createRoom("room-1");
      gameRoom.createRoom("room-2");

      gameRoom.addPlayerToRoom("room-1", "player-1");
      gameRoom.addPlayerToRoom("room-2", "player-1"); // Same player in different room

      const room1 = gameRoom.getRoomState("room-1");
      const room2 = gameRoom.getRoomState("room-2");

      expect(room1?.players.size).toBe(1);
      expect(room2?.players.size).toBe(1);

      gameRoom.movePlayer("room-1", "player-1", 5, 5);

      const p1_room1 = room1?.players.get("player-1");
      const p1_room2 = room2?.players.get("player-1");

      expect(p1_room1?.position).toEqual({ x: 5, y: 5 });
      expect(p1_room2?.position).toEqual({ x: 0, y: 0 });
    });
  });
});
