import type { World } from "./ecs";

export const TICK_RATE_MS = 50; // 20 Hz (1000ms / 20)
export const TICKS_PER_SECOND = 1000 / TICK_RATE_MS;

/**
 * Manages the fixed-rate game loop for a room
 */
export class GameLoop {
  private world: World;
  private tick = 0;
  private lastTickTime = 0;
  private tickTimer: number | null = null;

  constructor(world: World) {
    this.world = world;
    this.lastTickTime = Date.now();
  }

  /**
   * Start the game loop
   */
  start(onTick: (tick: number, deltaMs: number) => void): void {
    if (this.tickTimer !== null) {
      return; // Already running
    }

    const loop = () => {
      const now = Date.now();
      const deltaMs = now - this.lastTickTime;

      // Run world update
      this.world.update(TICK_RATE_MS);

      // Callback for custom logic (e.g., broadcasting to clients)
      onTick(this.tick, deltaMs);

      this.tick++;
      this.lastTickTime = now;

      // Schedule next tick
      this.tickTimer = (this.world as any).schedule
        ? // Durable Object context - use alarm
          null
        : // Browser context - use setTimeout
          (setTimeout(() => {
            loop();
          }, TICK_RATE_MS) as any);
    };

    // Schedule first tick
    this.tickTimer = setTimeout(() => {
      loop();
    }, TICK_RATE_MS) as any;
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Get current tick number
   */
  getTick(): number {
    return this.tick;
  }

  /**
   * Get the ECS world
   */
  getWorld(): World {
    return this.world;
  }
}
