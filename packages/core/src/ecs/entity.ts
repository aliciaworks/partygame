import type { Component } from './component';

/**
 * Entity represents a game object (player, enemy, projectile, etc.)
 * Entities are collections of components.
 */
export class Entity {
  /**
   * Unique identifier for this entity.
   */
  readonly id: string;

  /**
   * All components attached to this entity, keyed by component type.
   */
  private components = new Map<string, Component>();

  /**
   * Track if entity is marked for deletion.
   */
  private isDestroyed = false;

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Add a component to this entity.
   * If a component of the same type exists, it will be replaced.
   */
  addComponent<T extends Component>(component: T): T {
    this.components.set(component.type, component);
    return component;
  }

  /**
   * Get a component by type.
   */
  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  /**
   * Check if entity has a component of given type.
   */
  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  /**
   * Get all components on this entity.
   */
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  /**
   * Remove a component from this entity.
   */
  removeComponent(type: string): void {
    this.components.delete(type);
  }

  /**
   * Mark entity for deletion (will be removed by world next update).
   */
  destroy(): void {
    this.isDestroyed = true;
  }

  /**
   * Check if entity is marked for deletion.
   */
  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }

  /**
   * Serialize entity to JSON (for persistence or network sync).
   */
  toJSON(): Record<string, unknown> {
    const serialized: Record<string, unknown> = {
      id: this.id,
      components: {},
    };

    const components = serialized.components as Record<string, unknown>;
    for (const [type, component] of this.components) {
      components[type] = component.toJSON();
    }

    return serialized;
  }

  /**
   * Restore entity from JSON.
   * Requires that components are already registered in the world.
   */
  fromJSON(data: Record<string, unknown>, createComponent: (type: string) => Component | null): void {
    const components = data.components as Record<string, Record<string, unknown>>;
    if (!components) return;

    for (const [type, componentData] of Object.entries(components)) {
      const component = createComponent(type);
      if (component) {
        component.fromJSON(componentData);
        this.addComponent(component);
      }
    }
  }
}
