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
export const EntityComponentsSchema = z.object({
  transform: TransformComponentSchema.optional(),
  health: HealthComponentSchema.optional(),
  velocity: VelocityComponentSchema.optional(),
});

/**
 * Game tick update - contains all entity changes
 */
export const GameTickUpdateSchema = z.object({
  v: z.number(),
  tick: z.number(),
  timestamp: z.number(),
  entities: z.record(z.string(), EntityComponentsSchema),
});

/**
 * Player input command from client
 */
export const PlayerInputCommandSchema = z.object({
  type: z.enum(["MOVE", "JUMP", "ATTACK", "ABILITY"]),
  playerId: z.string(),
  data: z.record(z.string(), z.unknown()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TransformComponent = z.infer<typeof TransformComponentSchema>;
export type HealthComponent = z.infer<typeof HealthComponentSchema>;
export type VelocityComponent = z.infer<typeof VelocityComponentSchema>;
export type InputComponent = z.infer<typeof InputComponentSchema>;

export type EntityComponents = z.infer<typeof EntityComponentsSchema>;
export type GameTickUpdate = z.infer<typeof GameTickUpdateSchema>;
export type PlayerInputCommand = z.infer<typeof PlayerInputCommandSchema>;
