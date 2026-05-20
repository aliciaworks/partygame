import { Entity } from "./entity";
import type { Component } from "./component";
import { ComponentRegistry } from "./component";
import type { System } from "./system";

type ComponentFactory = () => Component;
type ComponentClass<T extends Component = Component> = new (
  ...args: any[]
) => T;

/**
 * World is the main ECS container.
 */
export class World {
  readonly entities = new Map<string, Entity>();

  private systems: System[] = [];
  private componentRegistry = new ComponentRegistry();
  private componentFactories = new Map<string, ComponentFactory>();
  private changedEntities = new Set<string>();

  registerComponent<T extends Component>(
    componentClass: ComponentClass<T>,
  ): void {
    const component = new componentClass();
    this.componentRegistry.register(component.type, componentClass);
    this.componentFactories.set(component.type, () => new componentClass());
  }

  registerComponentFactory(type: string, factory: ComponentFactory): void {
    this.componentFactories.set(type, factory);
  }

  createEntity(id: string): Entity {
    const entity = new Entity(id);
    this.entities.set(id, entity);
    this.changedEntities.add(id);
    return entity;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
    this.changedEntities.delete(id);
  }

  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  removeSystem(type: string): void {
    this.systems = this.systems.filter((s) => s.type !== type);
  }

  getSystem(type: string): System | undefined {
    return this.systems.find((s) => s.type === type);
  }

  replaceSystem(type: string, newSystem: System): void {
    this.removeSystem(type);
    this.addSystem(newSystem);
  }

  getSystems(): System[] {
    return [...this.systems];
  }

  update(deltaMs: number): void {
    this.changedEntities = new Set<string>();

    for (const system of this.systems) {
      system.update(this, deltaMs);
    }

    for (const entity of this.entities.values()) {
      if (entity.getIsDestroyed()) {
        this.removeEntity(entity.id);
      }
    }
  }

  markChanged(entityId: string): void {
    this.changedEntities.add(entityId);
  }

  getChangedEntities(): Set<string> {
    return new Set(this.changedEntities);
  }

  clearChangedEntities(): void {
    this.changedEntities.clear();
  }

  toJSON(): Record<string, unknown> {
    const entities: Record<string, unknown> = {};
    for (const [id, entity] of this.entities) {
      entities[id] = entity.toJSON();
    }

    return {
      entities,
      systems: this.systems.map((s) => s.type),
    };
  }

  fromJSON(data: Record<string, unknown>): void {
    const entities = data.entities as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (!entities) return;

    for (const [id, entityData] of Object.entries(entities)) {
      let entity = this.getEntity(id);
      if (!entity) {
        entity = this.createEntity(id);
      }
      entity.fromJSON(entityData, (type) => {
        const factory = this.componentFactories.get(type);
        return factory ? factory() : null;
      });
    }
  }
}
