import type { World } from "./world";

/**
 * Base class for all game systems.
 */
export abstract class System {
  readonly type: string;
  readonly priority: number;
  requiredComponents: string[] = [];

  constructor(type: string, priority = 0, requiredComponents: string[] = []) {
    this.type = type;
    this.priority = priority;
    this.requiredComponents = requiredComponents;
  }

  abstract update(world: World, deltaMs: number): void;

  shouldProcessEntity(entityComponents: string[]): boolean {
    if (this.requiredComponents.length === 0) return true;
    return this.requiredComponents.every((type) =>
      entityComponents.includes(type),
    );
  }
}

/**
 * System that applies to entities with specific component combinations.
 */
export abstract class FilteredSystem extends System {
  getTargetEntities(world: World) {
    return Array.from(world.entities.values()).filter((entity) => {
      const components = entity.getAllComponents().map((c) => c.type);
      return this.shouldProcessEntity(components);
    });
  }
}
