import { z } from "zod";

// ============================================================================
// ECS Component Schemas
// ============================================================================

/**
 * TransformComponent - Entity position, rotation, and scale
 */
export const TransformComponentSchema = z.object({
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
});

/**
 * HealthComponent - Entity HP and death state
 */
export const HealthComponentSchema = z.object({
  hp: z.number(),
  maxHp: z.number(),
  isDead: z.boolean().default(false),
});

/**
 * VelocityComponent - Movement velocity
 */
export const VelocityComponentSchema = z.object({
  vx: z.number().default(0),
  vy: z.number().default(0),
});

/**
 * InputComponent - Player input commands
 */
export const InputComponentSchema = z.object({
  moveX: z.number().default(0),
  moveY: z.number().default(0),
  isJumping: z.boolean().default(false),
  isSprinting: z.boolean().default(false),
});

/**
 * Entity state update from server
 */
export const EntityStateUpdateSchema = z.object({
  entityId: z.string(),
  components: z.array(
    z.object({
      type: z.string(),
      data: z.record(z.unknown()),
    })
  ),
});

/**
 * Game tick update - contains all entity changes
 */
export const GameTickUpdateSchema = z.object({
  tick: z.number(),
  timestamp: z.number(),
  entities: z.array(EntityStateUpdateSchema),
});

/**
 * Player input command from client
 */
export const PlayerInputCommandSchema = z.object({
  type: z.enum(["MOVE", "JUMP", "ATTACK", "ABILITY"]),
  playerId: z.string(),
  data: z.record(z.unknown()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TransformComponent = z.infer<typeof TransformComponentSchema>;
export type HealthComponent = z.infer<typeof HealthComponentSchema>;
export type VelocityComponent = z.infer<typeof VelocityComponentSchema>;
export type InputComponent = z.infer<typeof InputComponentSchema>;

export type EntityStateUpdate = z.infer<typeof EntityStateUpdateSchema>;
export type GameTickUpdate = z.infer<typeof GameTickUpdateSchema>;
export type PlayerInputCommand = z.infer<typeof PlayerInputCommandSchema>;
