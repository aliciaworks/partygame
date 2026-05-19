/**
 * Base class for all game components.
 * Components are data containers attached to entities.
 */
export abstract class Component {
  /**
   * Unique type identifier for this component.
   * Used for type-safe component lookup and serialization.
   */
  abstract readonly type: string;

  /**
   * Get component data as a plain object (for serialization).
   */
  abstract toJSON(): Record<string, unknown>;

  /**
   * Restore component from serialized data.
   */
  abstract fromJSON(data: Record<string, unknown>): void;
}

/**
 * Registry of all component types for type-safe lookups.
 */
export class ComponentRegistry {
  private types = new Map<string, typeof Component>();

  register(type: string, componentClass: typeof Component) {
    this.types.set(type, componentClass);
  }

  get(type: string): typeof Component | undefined {
    return this.types.get(type);
  }

  getAll() {
    return Array.from(this.types.entries());
  }
}
