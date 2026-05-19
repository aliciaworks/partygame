import type { World } from './world';

/**
 * Base class for all game systems.
 * Systems update entities with specific components each frame.
 * They implement game logic (movement, combat, physics, etc.)
 */
export abstract class System {
  /**
   * Unique identifier for this system.
   */
  readonly type: string;

  /**
   * Execution order (lower runs first). Default 0.
   * Use to control which systems run before others.
   */
  readonly priority: number;

  /**
   * Component types this system operates on (for filtering).
   * If empty, system runs unconditionally.
   */
  requiredComponents: string[] = [];

  constructor(type: string, priority = 0, requiredComponents: string[] = []) {
    this.type = type;
    this.priority = priority;
    this.requiredComponents = requiredComponents;
  }

  /**
   * Called once per game tick.
   * Implement game logic here.
   */
  abstract update(world: World, deltaMs: number): void;

  /**
   * Check if this system should process an entity.
   * Override for custom filtering logic.
   */
  shouldProcessEntity(entityComponents: string[]): boolean {
    if (this.requiredComponents.length === 0) return true;
    return this.requiredComponents.every((type) => entityComponents.includes(type));
  }
}

/**
 * System that applies to entities with specific component combinations.
 * Automatically filters entities by required components.
 */
export abstract class FilteredSystem extends System {
  /**
   * Get all entities matching the required components.
   * Override to customize entity filtering.
   */
  getTargetEntities(world: World) {
    return Array.from(world.entities.values()).filter((entity) => {
      const components = entity.getAllComponents().map((c) => c.type);
      return this.shouldProcessEntity(components);
    });
  }
}
