import {
  World,
  TransformComponent,
  HealthComponent,
  VelocityComponent,
  InputComponent,
  MovementSystem,
  FilteredSystem,
} from "@partygame/core";
import { GameLoop, TICK_RATE_MS } from "./game-loop";
import type { GameTickUpdate, PlayerInputCommand } from "@partygame/shared";

/**
 * Manages the game state and ECS world for a multiplayer room
 */
export class RoomGame {
  private world: World;
  private gameLoop: GameLoop;
  private playerIds = new Set<string>();
  private playerWebSockets = new Map<string, WebSocket>();
  private changedEntities = new Set<string>();

  constructor() {
    this.world = new World();

    // Register components
    this.world.registerComponent(TransformComponent);
    this.world.registerComponent(HealthComponent);
    this.world.registerComponent(VelocityComponent);
    this.world.registerComponent(InputComponent);

    // Register systems (execution order matters)
    // Priority 0: Input collection
    // Priority 1: Movement with validation
    this.world.addSystem(new MovementSystem());

    // Additional systems can be added here
    // Priority 2: Combat system, ability system, etc.

    this.gameLoop = new GameLoop(this.world);
  }

  /**
   * Add a player to the room
   */
  addPlayer(playerId: string, ws: WebSocket): void {
    if (this.playerIds.has(playerId)) {
      return;
    }

    this.playerIds.add(playerId);
    this.playerWebSockets.set(playerId, ws);

    // Create player entity in ECS world
    const entity = this.world.createEntity(playerId);
    entity.addComponent(new TransformComponent());
    entity.addComponent(new HealthComponent());
    entity.addComponent(new VelocityComponent());
    entity.addComponent(new InputComponent());

    // Mark as changed for initial sync
    this.world.markChanged(playerId);

    console.log(`Player ${playerId} joined room`);
  }

  /**
   * Remove a player from the room
   */
  removePlayer(playerId: string): void {
    if (!this.playerIds.has(playerId)) {
      return;
    }

    this.playerIds.delete(playerId);
    this.playerWebSockets.delete(playerId);

    // Destroy entity in ECS world
    const entity = this.world.getEntity(playerId);
    if (entity) {
      entity.destroy();
    }

    console.log(`Player ${playerId} left room`);
  }

  /**
   * Handle player input command
   */
  handlePlayerInput(playerId: string, command: PlayerInputCommand): void {
    const entity = this.world.getEntity(playerId);
    if (!entity) {
      return;
    }

    const inputComponent = entity.getComponent(InputComponent);
    if (!inputComponent) {
      return;
    }

    // Update input component based on command
    if (command.type === "MOVE") {
      const data = command.data as any;
      inputComponent.moveX = data.moveX || 0;
      inputComponent.moveY = data.moveY || 0;
      inputComponent.isSprinting = data.isSprinting || false;
      inputComponent.isJumping = data.isJumping || false;

      // Mark entity as changed
      this.world.markChanged(playerId);
    }
  }

  /**
   * Start the game loop
   */
  start(): void {
    this.gameLoop.start((tick, deltaMs) => {
      // Get changed entities from the world
      const changed = this.world.getChangedEntities();

      if (changed.size > 0) {
        // Build game tick update
        const update = this.buildGameTickUpdate(tick, changed);

        // Broadcast to all connected players
        this.broadcast(update);

        // Clear changed entities
        this.world.clearChangedEntities();
      }
    });

    console.log("Game loop started");
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.gameLoop.stop();
    console.log("Game loop stopped");
  }

  /**
   * Build a game tick update from changed entities
   */
  private buildGameTickUpdate(
    tick: number,
    changedEntities: Set<string>,
  ): GameTickUpdate {
    const entities: Record<string, any> = {};

    for (const entityId of changedEntities) {
      const entity = this.world.getEntity(entityId);
      if (!entity) continue;

      const components: Record<string, any> = {};

      // Get transform component
      const transform = entity.getComponent(TransformComponent);
      if (transform) {
        components.transform = {
          x: transform.x,
          y: transform.y,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
        };
      }

      // Get health component
      const health = entity.getComponent(HealthComponent);
      if (health) {
        components.health = {
          hp: health.hp,
          maxHp: health.maxHp,
          isDead: health.isDead,
        };
      }

      // Get velocity component
      const velocity = entity.getComponent(VelocityComponent);
      if (velocity) {
        components.velocity = {
          vx: velocity.vx,
          vy: velocity.vy,
        };
      }

      entities[entityId] = components;
    }

    return {
      v: 1, // Protocol version
      tick,
      timestamp: Date.now(),
      entities,
    };
  }

  /**
   * Broadcast game state to all players
   */
  private broadcast(update: GameTickUpdate): void {
    const message = JSON.stringify(update);

    for (const [playerId, ws] of this.playerWebSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.playerIds.size;
  }

  /**
   * Check if room is empty
   */
  isEmpty(): boolean {
    return this.playerIds.size === 0;
  }

  /**
   * Get ECS world (for testing/debugging)
   */
  getWorld(): World {
    return this.world;
  }
}
