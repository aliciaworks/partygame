import type { PlatformFeatures } from "./portal";

export const BUILTIN_PRESET_IDS = [
  "action",
  "card",
  "coop",
  "sports",
  "sandbox",
] as const;

export type BuiltinPresetId = (typeof BUILTIN_PRESET_IDS)[number];
export type PlatformPresetId = BuiltinPresetId | "custom";

export const FEATURE_KEYS = [
  "voiceChat",
  "textChat",
  "gameUpdates",
  "matchmaking",
  "leaderboard",
  "friends",
  "playerProfile",
] as const satisfies readonly (keyof PlatformFeatures)[];

/** Admin UI only — applying a preset PATCHes these flags to the backend. */
export const PRESET_FEATURES: Record<BuiltinPresetId, PlatformFeatures> = {
  /** FPS / MOBA — competitive action */
  action: {
    voiceChat: true,
    textChat: true,
    gameUpdates: true,
    matchmaking: true,
    leaderboard: true,
    friends: true,
    playerProfile: true,
  },
  /** Card / turn-based */
  card: {
    voiceChat: false,
    textChat: true,
    gameUpdates: true,
    matchmaking: false,
    leaderboard: true,
    friends: true,
    playerProfile: true,
  },
  /** Co-op PVE — fixed groups, no public matchmaking */
  coop: {
    voiceChat: true,
    textChat: true,
    gameUpdates: true,
    matchmaking: false,
    leaderboard: false,
    friends: true,
    playerProfile: true,
  },
  /** Sports / racing */
  sports: {
    voiceChat: true,
    textChat: false,
    gameUpdates: true,
    matchmaking: true,
    leaderboard: true,
    friends: false,
    playerProfile: true,
  },
  /** Sandbox / UGC */
  sandbox: {
    voiceChat: false,
    textChat: true,
    gameUpdates: true,
    matchmaking: false,
    leaderboard: false,
    friends: true,
    playerProfile: true,
  },
};

export const PRESET_OPTIONS: { id: BuiltinPresetId; labelKey: string; descKey: string }[] =
  [
    { id: "action", labelKey: "preset.action", descKey: "preset.actionDesc" },
    { id: "card", labelKey: "preset.card", descKey: "preset.cardDesc" },
    { id: "coop", labelKey: "preset.coop", descKey: "preset.coopDesc" },
    { id: "sports", labelKey: "preset.sports", descKey: "preset.sportsDesc" },
    { id: "sandbox", labelKey: "preset.sandbox", descKey: "preset.sandboxDesc" },
  ];

function featuresEqual(a: PlatformFeatures, b: PlatformFeatures): boolean {
  return FEATURE_KEYS.every((key) => a[key] === b[key]);
}

export function resolvePresetFromFeatures(
  features: PlatformFeatures,
): PlatformPresetId {
  for (const id of BUILTIN_PRESET_IDS) {
    if (featuresEqual(features, PRESET_FEATURES[id])) return id;
  }
  return "custom";
}

export function isBuiltinPreset(value: string): value is BuiltinPresetId {
  return (BUILTIN_PRESET_IDS as readonly string[]).includes(value);
}
