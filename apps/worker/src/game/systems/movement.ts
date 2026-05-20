import { FilteredSystem } from "../ecs/system";
import type { World } from "../ecs/world";
import { InputComponent, TransformComponent } from "../components";

/**
 * Server-authoritative movement system.
 */
export class MovementSystem extends FilteredSystem {
  private readonly maxSpeed = 10;
  private readonly sprintMultiplier = 1.5;

  constructor() {
    super("movement", 1, ["transform", "input"]);
  }

  update(world: World, deltaMs: number): void {
    const entities = this.getTargetEntities(world);

    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>("transform");
      const input = entity.getComponent<InputComponent>("input");

      if (!transform || !input) continue;

      const maxSpeed =
        this.maxSpeed * (input.isSprinting ? this.sprintMultiplier : 1);
      const targetX = transform.x + input.moveX * maxSpeed * (deltaMs / 1000);
      const targetY = transform.y + input.moveY * maxSpeed * (deltaMs / 1000);

      if (
        this.isMoveWithinBounds(
          transform.x,
          transform.y,
          targetX,
          targetY,
          maxSpeed,
        )
      ) {
        transform.x = targetX;
        transform.y = targetY;

        if (input.moveX !== 0 || input.moveY !== 0) {
          transform.rotation = Math.atan2(input.moveY, input.moveX);
        }

        world.markChanged(entity.id);
      }

      input.reset();
    }
  }

  private isMoveWithinBounds(
    currentX: number,
    currentY: number,
    targetX: number,
    targetY: number,
    maxSpeed: number,
  ): boolean {
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const distanceSq = dx * dx + dy * dy;
    const maxDistanceSq = maxSpeed * maxSpeed;

    return distanceSq <= maxDistanceSq;
  }
}
