import type { Component } from "./component";

/**
 * Entity represents a game object such as a player, enemy, or projectile.
 */
export class Entity {
  readonly id: string;

  private components = new Map<string, Component>();
  private isDestroyed = false;

  constructor(id: string) {
    this.id = id;
  }

  addComponent<T extends Component>(component: T): T {
    this.components.set(component.type, component);
    return component;
  }

  getComponent<T extends Component>(type: string): T | undefined;
  getComponent<T extends Component>(
    componentClass: new (...args: any[]) => T,
  ): T | undefined;
  getComponent<T extends Component>(
    typeOrClass: string | (new (...args: any[]) => T),
  ): T | undefined {
    const type =
      typeof typeOrClass === "string" ? typeOrClass : new typeOrClass().type;
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  removeComponent(type: string): void {
    this.components.delete(type);
  }

  destroy(): void {
    this.isDestroyed = true;
  }

  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }

  toJSON(): Record<string, unknown> {
    const components: Record<string, unknown> = {};
    for (const [type, component] of this.components) {
      components[type] = component.toJSON();
    }

    return {
      id: this.id,
      components,
    };
  }

  fromJSON(
    data: Record<string, unknown>,
    createComponent: (type: string) => Component | null,
  ): void {
    const components = data.components as
      | Record<string, Record<string, unknown>>
      | undefined;
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
