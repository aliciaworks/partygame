/**
 * Example: Using the ECS framework to create a simple game world.
 * This demonstrates how game types (FPS, MOBA, RPG, etc.) can use PartyGame's ECS.
 */

import { World } from '../ecs/world';
import { TransformComponent, HealthComponent, InputComponent, VelocityComponent } from '../components';
import { MovementSystem, InputSystem } from '../systems/movement';

/**
 * Example: Create a multiplayer FPS game using PartyGame's ECS
 */
export function createFPSGameWorld() {
  const world = new World();

  // Register all components
  world.registerComponent('transform', TransformComponent);
  world.registerComponentFactory('transform', () => new TransformComponent());

  world.registerComponent('health', HealthComponent);
  world.registerComponentFactory('health', () => new HealthComponent(100));

  world.registerComponent('velocity', VelocityComponent);
  world.registerComponentFactory('velocity', () => new VelocityComponent());

  world.registerComponent('input', InputComponent);
  world.registerComponentFactory('input', () => new InputComponent());

  // Add systems to handle game logic
  world.addSystem(new InputSystem()); // Priority 0: collect input
  world.addSystem(new MovementSystem()); // Priority 1: apply movement

  return world;
}

/**
 * Example: Create a player entity in the game world
 */
export function createPlayerEntity(world: World, playerId: string, initialX = 0, initialY = 0) {
  const player = world.createEntity(playerId);

  // Add components to define the player
  player.addComponent(new TransformComponent(initialX, initialY));
  player.addComponent(new HealthComponent(100)); // FPS: 100 HP
  player.addComponent(new InputComponent()); // Ready to receive player input
  player.addComponent(new VelocityComponent()); // For movement

  return player;
}

/**
 * Example: Simulate a game tick (called from Room's 20 Hz loop)
 */
export function simulateGameTick(world: World, deltaMs: number) {
  // Update all entities with all systems
  world.update(deltaMs);

  // Get entities that changed (for network sync)
  const changedEntityIds = world.getChangedEntities();

  // Send delta updates to all clients
  const updates = Array.from(changedEntityIds).map((id) => {
    const entity = world.getEntity(id);
    if (!entity) return null;

    return {
      entityId: id,
      components: entity.getAllComponents().map((c) => ({
        type: c.type,
        data: c.toJSON(),
      })),
    };
  });

  // Clear changed entities for next tick
  world.clearChangedEntities();

  return updates;
}

/**
 * Example: Handle player input from WebSocket message
 */
export function handlePlayerInput(world: World, playerId: string, inputData: {
  moveX: number;
  moveY: number;
  isJumping?: boolean;
  isSprinting?: boolean;
}) {
  const player = world.getEntity(playerId);
  if (!player) return;

  const input = player.getComponent<InputComponent>('input');
  if (input) {
    input.moveX = inputData.moveX;
    input.moveY = inputData.moveY;
    input.isJumping = inputData.isJumping ?? false;
    input.isSprinting = inputData.isSprinting ?? false;
  }

  world.markChanged(playerId);
}

/**
 * Example: Apply damage to a player (from combat system)
 */
export function damagePlayer(world: World, playerId: string, damage: number) {
  const player = world.getEntity(playerId);
  if (!player) return false;

  const health = player.getComponent<HealthComponent>('health');
  if (health && !health.isDead) {
    health.takeDamage(damage);
    world.markChanged(playerId);
    return true;
  }

  return false;
}

/**
 * Example: Get player state for sending to client (serialization)
 */
export function getPlayerState(world: World, playerId: string) {
  const player = world.getEntity(playerId);
  if (!player) return null;

  const transform = player.getComponent<TransformComponent>('transform');
  const health = player.getComponent<HealthComponent>('health');

  return {
    id: playerId,
    position: transform ? { x: transform.x, y: transform.y } : undefined,
    health: health
      ? { hp: health.hp, maxHp: health.maxHp, isDead: health.isDead }
      : undefined,
  };
}
