import { describe, expect, it } from "vitest";

import {
  HealthComponent,
  InputComponent,
  MovementSystem,
  TransformComponent,
  VelocityComponent,
  World,
} from "../src/game";

describe("worker game runtime", () => {
  it("creates an ECS player entity with registered components", () => {
    const world = new World();
    world.registerComponent(TransformComponent);
    world.registerComponent(HealthComponent);
    world.registerComponent(VelocityComponent);
    world.registerComponent(InputComponent);

    const entity = world.createEntity("player-1");
    entity.addComponent(new TransformComponent());
    entity.addComponent(new HealthComponent());
    entity.addComponent(new VelocityComponent());
    entity.addComponent(new InputComponent());

    expect(entity.getComponent(TransformComponent)?.type).toBe("transform");
    expect(entity.getComponent(HealthComponent)?.hp).toBe(100);
  });

  it("applies server-side movement from input components", () => {
    const world = new World();
    const entity = world.createEntity("player-1");
    const transform = entity.addComponent(new TransformComponent());
    const input = entity.addComponent(new InputComponent());

    input.moveX = 1;
    input.moveY = 0;

    world.addSystem(new MovementSystem());
    world.update(50);

    expect(transform.x).toBeGreaterThan(0);
    expect(transform.y).toBe(0);
    expect(input.moveX).toBe(0);
    expect(world.getChangedEntities()).toContain("player-1");
  });
});
