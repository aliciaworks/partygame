import { describe, expect, it } from "vitest";

import { buildGeneratedArtifacts } from "./typegen";

describe("type generation", () => {
  it("generates engine-specific artifacts from the shared schemas", () => {
    const artifacts = buildGeneratedArtifacts();

    expect(artifacts["unity/Runtime/PartyGameTypes.cs"]).toContain(
      "public class PlayerState",
    );
    expect(artifacts["unity/Runtime/PartyGameTypes.cs"]).toContain(
      "public float health;",
    );
    expect(artifacts["godot/addons/partygame/edge_pulse_types.gd"]).toContain(
      "var item_id: String",
    );
    expect(
      artifacts["unreal/PartyGame/Source/PartyGame/Public/PartyGameTypes.h"],
    ).toContain("FPartyGamePurchaseRequest");
  });
});
