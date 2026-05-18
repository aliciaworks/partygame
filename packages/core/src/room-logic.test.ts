import { describe, expect, it } from "vitest";

import {
  createPlayerState,
  isMoveWithinBounds,
  isPlayerTimedOut,
  normalizeMovePayload,
  parseClientMessage,
} from "./room-logic";

describe("room logic", () => {
  it("parses valid client messages", () => {
    expect(parseClientMessage('{"type":"PING"}')).toEqual({
      type: "PING",
      payload: undefined,
    });
    expect(
      parseClientMessage('{"type":"MOVE","payload":{"x":1,"y":2}}'),
    ).toEqual({
      type: "MOVE",
      payload: { x: 1, y: 2 },
    });
  });

  it("rejects invalid move payloads", () => {
    expect(normalizeMovePayload(null)).toBeNull();
    expect(normalizeMovePayload({ x: 1, y: Number.NaN })).toBeNull();
  });

  it("checks movement bounds and timeouts", () => {
    expect(isMoveWithinBounds({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
    expect(isMoveWithinBounds({ x: 0, y: 0 }, { x: 11, y: 0 })).toBe(false);
    expect(isPlayerTimedOut(1_000, 16_000, 15_000)).toBe(false);
    expect(isPlayerTimedOut(1_000, 16_001, 15_000)).toBe(true);
  });

  it("creates a deterministic player state", () => {
    expect(createPlayerState("player-1", 123)).toEqual({
      id: "player-1",
      position: { x: 0, y: 0 },
      lastUpdated: 123,
      lastPing: 123,
    });
  });
});
