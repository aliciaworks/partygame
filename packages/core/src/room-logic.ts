export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  position: Vector2;
  lastUpdated: number;
  lastPing: number;
}

export interface RoomState {
  players: Record<string, PlayerState>;
}

export interface MovePayload {
  x: number;
  y: number;
}

export interface ClientMessage {
  type: "MOVE" | "PING";
  payload?: unknown;
}

export const TICK_RATE_HZ = 20;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;
export const MAX_SPEED_PER_TICK = 10;
export const CLIENT_TIMEOUT_MS = 15000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function createPlayerState(id: string, now = Date.now()): PlayerState {
  return {
    id,
    position: { x: 0, y: 0 },
    lastUpdated: now,
    lastPing: now,
  };
}

export function parseClientMessage(message: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(message) as Record<string, unknown>;

    if (parsed.type !== "MOVE" && parsed.type !== "PING") {
      return null;
    }

    return {
      type: parsed.type,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
}

export function normalizeMovePayload(payload: unknown): MovePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) {
    return null;
  }

  return { x: candidate.x, y: candidate.y };
}

export function isMoveWithinBounds(
  currentPosition: Vector2,
  targetPosition: Vector2,
  maxSpeedPerTick = MAX_SPEED_PER_TICK,
): boolean {
  const dx = targetPosition.x - currentPosition.x;
  const dy = targetPosition.y - currentPosition.y;
  const maxDistanceSq = maxSpeedPerTick * maxSpeedPerTick;

  return dx * dx + dy * dy <= maxDistanceSq;
}

export function isPlayerTimedOut(
  lastPing: number,
  now = Date.now(),
  timeoutMs = CLIENT_TIMEOUT_MS,
): boolean {
  return now - lastPing > timeoutMs;
}
