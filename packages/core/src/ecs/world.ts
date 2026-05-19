import { Entity } from './entity';
import type { Component } from './component';
import { ComponentRegistry } from './component';
import type { System } from './system';

/**
 * Factory function type for creating components.
 */
type ComponentFactory = () => Component;

/**
 * World is the main ECS container.
 * It manages all entities, components, and systems.
 */
export class World {
  /**
   * All entities in this world, keyed by ID.
   */
  readonly entities = new Map<string, Entity>();

  /**
   * All systems in this world, sorted by priority.
   */
  private systems: System[] = [];

  /**
   * Component registry for type management.
   */
  private componentRegistry = new ComponentRegistry();

  /**
   * Component factories for deserialization.
   */
  private componentFactories = new Map<string, ComponentFactory>();

  /**
   * Tracks which entities have changed this frame (for delta updates).
   */
  private changedEntities = new Set<string>();

  constructor() {}

  /**
   * Register a component type so it can be created by the world.
   */
  registerComponent(type: string, componentClass: typeof Component) {
    this.componentRegistry.register(type, componentClass);
  }

  /**
   * Register a component factory for deserialization.
   */
  registerComponentFactory(type: string, factory: ComponentFactory) {
    this.componentFactories.set(type, factory);
  }

  /**
   * Create and add an entity to the world.
   */
  createEntity(id: string): Entity {
    const entity = new Entity(id);
    this.entities.set(id, entity);
    this.changedEntities.add(id);
    return entity;
  }

  /**
   * Get an entity by ID.
   */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Remove an entity from the world.
   */
  removeEntity(id: string): void {
    this.entities.delete(id);
    this.changedEntities.delete(id);
  }

  /**
   * Add a system to the world.
   * Systems are executed in priority order (lower number runs first).
   */
  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a system from the world.
   */
  removeSystem(type: string): void {
    this.systems = this.systems.filter((s) => s.type !== type);
  }

  /**
   * Get a system by type.
   */
  getSystem(type: string): System | undefined {
    return this.systems.find((s) => s.type === type);
  }

  /**
   * Replace a system with a new one (useful for hot-reloading).
   */
  replaceSystem(type: string, newSystem: System): void {
    this.removeSystem(type);
    this.addSystem(newSystem);
  }

  /**
   * Get all systems in execution order.
   */
  getSystems(): System[] {
    return [...this.systems];
  }

  /**
   * Execute all systems in order. Called once per game tick.
   */
  update(deltaMs: number): void {
    // Clear changed entities from previous frame
    const previouslyChanged = this.changedEntities;
    this.changedEntities = new Set<string>();

    // Run each system
    for (const system of this.systems) {
      system.update(this, deltaMs);
    }

    // Clean up destroyed entities
    for (const entity of this.entities.values()) {
      if (entity.getIsDestroyed()) {
        this.removeEntity(entity.id);
      }
    }
  }

  /**
   * Mark an entity as changed (for network synchronization).
   */
  markChanged(entityId: string): void {
    this.changedEntities.add(entityId);
  }

  /**
   * Get entities that changed since last frame.
   */
  getChangedEntities(): Set<string> {
    return new Set(this.changedEntities);
  }

  /**
   * Clear the changed entities set (after sending updates to clients).
   */
  clearChangedEntities(): void {
    this.changedEntities.clear();
  }

  /**
   * Serialize the entire world state to JSON.
   */
  toJSON(): Record<string, unknown> {
    const entitiesData: Record<string, unknown> = {};
    for (const [id, entity] of this.entities) {
      entitiesData[id] = entity.toJSON();
    }

    return {
      entities: entitiesData,
      systems: this.systems.map((s) => s.type),
    };
  }

  /**
   * Restore world state from JSON.
   */
  fromJSON(data: Record<string, unknown>): void {
    const entitiesData = data.entities as Record<string, Record<string, unknown>>;
    if (!entitiesData) return;

    for (const [id, entityData] of Object.entries(entitiesData)) {
      let entity = this.getEntity(id);
      if (!entity) {
        entity = this.createEntity(id);
      }
      entity.fromJSON(entityData, (type) => {
        const factory = this.componentFactories.get(type);
        if (!factory) return null;
        return factory();
      });
    }
  }
}
