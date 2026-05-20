/**
 * Base class for all game components.
 * Components are data containers attached to entities.
 */
export abstract class Component {
  abstract readonly type: string;

  abstract toJSON(): Record<string, unknown>;

  abstract fromJSON(data: Record<string, unknown>): void;
}

/**
 * Registry of all component types for type-safe lookups.
 */
export class ComponentRegistry {
  private types = new Map<string, typeof Component>();

  register(type: string, componentClass: typeof Component): void {
    this.types.set(type, componentClass);
  }

  get(type: string): typeof Component | undefined {
    return this.types.get(type);
  }

  getAll(): Array<[string, typeof Component]> {
    return Array.from(this.types.entries());
  }
}
