import { z } from "zod";

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const PlayerStateSchema = z.object({
  id: z.string(),
  position: Vector3Schema,
  rotation: Vector3Schema,
  health: z.number(),
});

export const PurchaseRequestSchema = z.object({
  itemId: z.string(),
  cost: z.number(),
  idempotencyKey: z.string(),
});

export type Vector3 = z.infer<typeof Vector3Schema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;
