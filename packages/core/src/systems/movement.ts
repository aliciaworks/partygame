import { FilteredSystem } from '../ecs/system';
import type { World } from '../ecs/world';
import { TransformComponent } from '../components/index';
import { InputComponent } from '../components/index';

/**
 * MovementSystem handles player movement.
 * It takes player input and updates the transform position.
 * Server-authoritative: validates moves against game rules.
 */
export class MovementSystem extends FilteredSystem {
  // Constants
  private readonly MAX_SPEED = 10; // units per tick
  private readonly ACCELERATION = 0.5;
  private readonly DECELERATION = 0.3;
  private readonly SPRINT_MULTIPLIER = 1.5;

  constructor() {
    super('movement', 1, ['transform', 'input']); // Priority 1: run after input collection
  }

  update(world: World, deltaMs: number): void {
    const entities = this.getTargetEntities(world);

    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>('transform');
      const input = entity.getComponent<InputComponent>('input');

      if (!transform || !input) continue;

      // Server-authoritative movement validation
      const maxSpeed = this.MAX_SPEED * (input.isSprinting ? this.SPRINT_MULTIPLIER : 1);

      // Calculate new position based on input
      const targetX = transform.x + input.moveX * maxSpeed * (deltaMs / 1000);
      const targetY = transform.y + input.moveY * maxSpeed * (deltaMs / 1000);

      // Validate move is within bounds (anti-cheat)
      if (this.isMoveWithinBounds(transform.x, transform.y, targetX, targetY, maxSpeed)) {
        transform.x = targetX;
        transform.y = targetY;

        // Update rotation to face movement direction
        if (input.moveX !== 0 || input.moveY !== 0) {
          transform.rotation = Math.atan2(input.moveY, input.moveX);
        }

        world.markChanged(entity.id);
      }

      // Clear input for next frame
      input.reset();
    }
  }

  /**
   * Validate that the movement doesn't exceed maximum speed (anti-cheat).
   */
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

/**
 * InputSystem collects and validates player input from WebSocket messages.
 * Runs first each frame to collect fresh input.
 */
export class InputSystem extends FilteredSystem {
  constructor() {
    super('input', 0, ['input']); // Priority 0: run first
  }

  update(_world: World, _deltaMs: number): void {
    // This system is a placeholder.
    // In practice, input is pushed to entities by the WebSocket handler.
    // See room.ts for how input messages are processed.
  }
}
