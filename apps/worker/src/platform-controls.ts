/** Feature flags — each maps to optional platform APIs. */
export interface PlatformFeatures {
  voiceChat: boolean;
  textChat: boolean;
  gameUpdates: boolean;
  matchmaking: boolean;
}

/** A game type is only a named, reusable combination of feature toggles. */
export interface GameTypePreset {
  id: string;
  name: string;
  description: string;
  features: PlatformFeatures;
}

export interface PlatformState {
  /** Currently applied feature flags (live config). */
  features: PlatformFeatures;
  /** Saved custom game-type presets. */
  gameTypes: GameTypePreset[];
  /** Id of the preset last applied, if any. */
  activeGameTypeId: string | null;
}

export interface PlatformBindings {
  PLATFORM_BUCKET?: R2Bucket;
  ADMIN_TOKEN?: string;
  REALTIMEKIT_APP_ID?: string;
  REALTIMEKIT_API_TOKEN?: string;
}

export interface VoiceRoomBootstrap {
  provider: "realtimekit";
  roomId: string;
  enabled: boolean;
  joinMode: "client-managed";
  appId: string | null;
  joinHint: string;
}

export interface GameUpdateAssetMeta {
  key: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

const STATE_KEY = "admin/platform-state.json";
const GAME_UPDATES_PREFIX = "game-updates/";

export const FEATURE_KEYS = [
  "voiceChat",
  "textChat",
  "gameUpdates",
  "matchmaking",
] as const satisfies readonly (keyof PlatformFeatures)[];

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const DEFAULT_FEATURES: PlatformFeatures = {
  voiceChat: true,
  textChat: true,
  gameUpdates: true,
  matchmaking: true,
};

const DEFAULT_GAME_TYPES: GameTypePreset[] = [
  {
    id: "fps",
    name: "FPS",
    description: "Voice, chat, and matchmaking.",
    features: {
      voiceChat: true,
      textChat: true,
      gameUpdates: true,
      matchmaking: true,
    },
  },
  {
    id: "moba",
    name: "MOBA",
    description: "Text chat and hot updates; no voice.",
    features: {
      voiceChat: false,
      textChat: true,
      gameUpdates: true,
      matchmaking: true,
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Hot updates only.",
    features: {
      voiceChat: false,
      textChat: false,
      gameUpdates: true,
      matchmaking: false,
    },
  },
];

let memoryState: PlatformState = {
  features: { ...DEFAULT_FEATURES },
  gameTypes: DEFAULT_GAME_TYPES.map((preset) => ({
    ...preset,
    features: { ...preset.features },
  })),
  activeGameTypeId: null,
};

function normalizeFeatures(
  partial: Partial<PlatformFeatures> | null | undefined,
): PlatformFeatures {
  const base = { ...DEFAULT_FEATURES };
  if (!partial) return base;

  for (const key of FEATURE_KEYS) {
    if (typeof partial[key] === "boolean") {
      base[key] = partial[key];
    }
  }
  return base;
}

function normalizeGameType(raw: Partial<GameTypePreset>): GameTypePreset | null {
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    description:
      typeof raw.description === "string" ? raw.description.trim() : "",
    features: normalizeFeatures(raw.features),
  };
}

function normalizeState(raw: Partial<PlatformState> | null | undefined): PlatformState {
  const gameTypes = Array.isArray(raw?.gameTypes)
    ? raw.gameTypes
        .map((item) => normalizeGameType(item as Partial<GameTypePreset>))
        .filter((item): item is GameTypePreset => item !== null)
    : memoryState.gameTypes;

  return {
    features: normalizeFeatures(raw?.features),
    gameTypes: gameTypes.length > 0 ? gameTypes : memoryState.gameTypes,
    activeGameTypeId:
      typeof raw?.activeGameTypeId === "string" ? raw.activeGameTypeId : null,
  };
}

export async function loadPlatformState(
  bucket?: R2Bucket,
): Promise<PlatformState> {
  if (!bucket) {
    return memoryState;
  }

  const object = await bucket.get(STATE_KEY);
  if (!object) {
    return memoryState;
  }

  try {
    const parsed = JSON.parse(await object.text()) as Partial<PlatformState>;
    memoryState = normalizeState(parsed);
    return memoryState;
  } catch {
    return memoryState;
  }
}

async function persistPlatformState(
  bucket: R2Bucket | undefined,
  state: PlatformState,
): Promise<PlatformState> {
  memoryState = normalizeState(state);

  if (bucket) {
    await bucket.put(STATE_KEY, JSON.stringify(memoryState, null, 2), {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
      },
    });
  }

  return memoryState;
}

export async function savePlatformFeatures(
  bucket: R2Bucket | undefined,
  updates: Partial<PlatformFeatures>,
): Promise<PlatformState> {
  const next: PlatformState = {
    ...memoryState,
    features: normalizeFeatures({ ...memoryState.features, ...updates }),
    activeGameTypeId: null,
  };
  return persistPlatformState(bucket, next);
}

export async function applyGameType(
  bucket: R2Bucket | undefined,
  gameTypeId: string,
): Promise<PlatformState> {
  const preset = memoryState.gameTypes.find((item) => item.id === gameTypeId);
  if (!preset) {
    throw new Error(`Unknown game type: ${gameTypeId}`);
  }

  const next: PlatformState = {
    ...memoryState,
    features: { ...preset.features },
    activeGameTypeId: preset.id,
  };
  return persistPlatformState(bucket, next);
}

export async function upsertGameType(
  bucket: R2Bucket | undefined,
  preset: GameTypePreset,
): Promise<PlatformState> {
  const normalized = normalizeGameType(preset);
  if (!normalized) {
    throw new Error("Invalid game type preset");
  }

  const gameTypes = memoryState.gameTypes.filter(
    (item) => item.id !== normalized.id,
  );
  gameTypes.push(normalized);

  const next: PlatformState = {
    ...memoryState,
    gameTypes,
  };
  return persistPlatformState(bucket, next);
}

export async function deleteGameType(
  bucket: R2Bucket | undefined,
  gameTypeId: string,
): Promise<PlatformState> {
  const next: PlatformState = {
    ...memoryState,
    gameTypes: memoryState.gameTypes.filter((item) => item.id !== gameTypeId),
    activeGameTypeId:
      memoryState.activeGameTypeId === gameTypeId
        ? null
        : memoryState.activeGameTypeId,
  };
  return persistPlatformState(bucket, next);
}

export function isRouteAllowed(
  routePath: string,
  features: PlatformFeatures,
): boolean {
  if (routePath.startsWith("/api/chat")) return features.textChat;
  if (routePath.startsWith("/api/matchmaking")) return features.matchmaking;
  if (routePath.startsWith("/api/voice")) return features.voiceChat;
  if (routePath.startsWith("/api/updates")) return features.gameUpdates;
  return true;
}

export function buildVoiceRoomBootstrap(
  roomId: string,
  features: PlatformFeatures,
  env: PlatformBindings,
): VoiceRoomBootstrap {
  return {
    provider: "realtimekit",
    roomId,
    enabled: features.voiceChat,
    joinMode: "client-managed",
    appId: env.REALTIMEKIT_APP_ID ?? null,
    joinHint: env.REALTIMEKIT_APP_ID
      ? "Create the room in RealtimeKit, then hand the room metadata to the client SDK."
      : "RealtimeKit is not configured for this environment.",
  };
}

export async function listGameUpdateAssets(
  bucket: R2Bucket | undefined,
): Promise<GameUpdateAssetMeta[]> {
  if (!bucket) return [];

  const listed = await bucket.list({ prefix: GAME_UPDATES_PREFIX });
  const items: GameUpdateAssetMeta[] = [];

  for (const object of listed.objects) {
    const head = await bucket.head(object.key);
    const fileName = object.key.slice(GAME_UPDATES_PREFIX.length);
    const dash = fileName.indexOf("-");
    const name = dash >= 0 ? fileName.slice(dash + 1) : fileName;

    items.push({
      key: object.key,
      name,
      size: object.size,
      contentType:
        head?.httpMetadata?.contentType ?? "application/octet-stream",
      uploadedAt: object.uploaded.toISOString(),
    });
  }

  return items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function storeGameUpdateAsset(
  bucket: R2Bucket | undefined,
  input: { name: string; content: ArrayBuffer | Uint8Array; contentType?: string },
): Promise<GameUpdateAssetMeta> {
  const safeName = input.name.replace(/[^\w.\-]+/g, "_") || "asset";
  const key = `${GAME_UPDATES_PREFIX}${Date.now()}-${safeName}`;
  const contentType = input.contentType ?? "application/octet-stream";
  const body =
    input.content instanceof Uint8Array
      ? input.content
      : new Uint8Array(input.content);

  if (bucket) {
    await bucket.put(key, body, {
      httpMetadata: { contentType },
    });
  }

  return {
    key,
    name: safeName,
    size: body.byteLength,
    contentType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteGameUpdateAsset(
  bucket: R2Bucket | undefined,
  key: string,
): Promise<void> {
  if (!bucket || !key.startsWith(GAME_UPDATES_PREFIX)) return;
  await bucket.delete(key);
}

export async function getGameUpdateAsset(
  bucket: R2Bucket | undefined,
  key: string,
): Promise<{ body: ReadableStream; meta: GameUpdateAssetMeta } | null> {
  if (!bucket || !key.startsWith(GAME_UPDATES_PREFIX)) return null;

  const object = await bucket.get(key);
  if (!object) return null;

  const fileName = key.slice(GAME_UPDATES_PREFIX.length);
  const dash = fileName.indexOf("-");
  const name = dash >= 0 ? fileName.slice(dash + 1) : fileName;

  return {
    body: object.body,
    meta: {
      key,
      name,
      size: object.size,
      contentType:
        object.httpMetadata?.contentType ?? "application/octet-stream",
      uploadedAt: object.uploaded.toISOString(),
    },
  };
}

/** @deprecated Use loadPlatformState */
export async function loadPlatformControls(bucket?: R2Bucket) {
  const state = await loadPlatformState(bucket);
  return state.features;
}
