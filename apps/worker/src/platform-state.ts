export type PlatformFeatures = {
  voiceChat: boolean;
  textChat: boolean;
  gameUpdates: boolean;
  matchmaking: boolean;
  leaderboard: boolean;
  friends: boolean;
  playerProfile: boolean;
};

export type Deprecation = {
  path: string;
  removedAt: string; // ISO date string (YYYY-MM-DD)
  alternative?: string; // recommended migration path
  reason?: string;
};

export type PlatformState = {
  features: PlatformFeatures;
  apiVersion: string; // ISO date (YYYY-MM-DD) - deployment date
  minClientVersion?: string; // minimum required client version (SemVer)
  deprecations: Deprecation[]; // APIs scheduled for removal
  revision: number;
  updatedAt: string;
};

const PLATFORM_STATE_KEY = "admin/platform-state.json";
const PLATFORM_STATE_CACHE_TTL_MS = 15_000;

const DEFAULT_FEATURES: PlatformFeatures = {
  voiceChat: true,
  textChat: true,
  gameUpdates: true,
  matchmaking: true,
  leaderboard: true,
  friends: true,
  playerProfile: true,
};

const FEATURE_KEYS = Object.keys(DEFAULT_FEATURES) as Array<keyof PlatformFeatures>;
let platformStateCache:
  | {
      value: PlatformState;
      expiresAt: number;
    }
  | null = null;

export class PlatformStateConflictError extends Error {
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super(`Platform state revision mismatch (expected ${expectedRevision}, actual ${actualRevision})`);
    this.name = "PlatformStateConflictError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function normalizeFeatures(input: unknown): PlatformFeatures {
  const source = (input ?? {}) as Partial<PlatformFeatures>;
  const next = { ...DEFAULT_FEATURES };

  for (const key of FEATURE_KEYS) {
    if (typeof source[key] === "boolean") {
      next[key] = source[key];
    }
  }

  return next;
}

function getISODateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getDefaultState(): PlatformState {
  return {
    features: { ...DEFAULT_FEATURES },
    apiVersion: getISODateString(),
    deprecations: [],
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
}

function writeCache(state: PlatformState): void {
  platformStateCache = {
    value: state,
    expiresAt: Date.now() + PLATFORM_STATE_CACHE_TTL_MS,
  };
}

function invalidatePlatformStateCache(): void {
  platformStateCache = null;
}

// Validate deprecation entries
function normalizeDeprecations(input: unknown): Deprecation[] {
  if (!Array.isArray(input)) return [];
  
  return input
    .map((item: unknown) => {
      const obj = item as Partial<Deprecation>;
      if (typeof obj.path === "string" && typeof obj.removedAt === "string") {
        return {
          path: obj.path,
          removedAt: obj.removedAt,
          alternative: obj.alternative,
          reason: obj.reason,
        } as Deprecation;
      }
      return undefined;
    })
    .filter((item): item is Deprecation => item !== undefined);
}

export async function readPlatformState(
  bucket: R2Bucket | undefined,
): Promise<PlatformState> {
  if (platformStateCache && platformStateCache.expiresAt > Date.now()) {
    return platformStateCache.value;
  }

  if (!bucket) {
    const fallback = getDefaultState();
    writeCache(fallback);
    return fallback;
  }

  const object = await bucket.get(PLATFORM_STATE_KEY);
  if (!object) {
    const fallback = getDefaultState();
    writeCache(fallback);
    return fallback;
  }

  try {
    const parsed = JSON.parse(await object.text()) as Partial<PlatformState>;
    const state: PlatformState = {
      features: normalizeFeatures(parsed.features),
      apiVersion: parsed.apiVersion ?? getISODateString(),
      minClientVersion: parsed.minClientVersion,
      deprecations: normalizeDeprecations(parsed.deprecations),
      revision: typeof parsed.revision === "number" ? parsed.revision : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
    writeCache(state);
    return state;
  } catch {
    const fallback = getDefaultState();
    writeCache(fallback);
    return fallback;
  }
}

export async function patchPlatformFeatures(
  bucket: R2Bucket | undefined,
  updates: unknown,
  expectedRevision?: number,
): Promise<PlatformState> {
  invalidatePlatformStateCache();
  const current = await readPlatformState(bucket);
  if (typeof expectedRevision === "number" && expectedRevision !== current.revision) {
    throw new PlatformStateConflictError(expectedRevision, current.revision);
  }
  const merged = normalizeFeatures({
    ...current.features,
    ...(updates as Partial<PlatformFeatures>),
  });
  const state: PlatformState = {
    features: merged,
    apiVersion: getISODateString(),
    minClientVersion: current.minClientVersion,
    deprecations: current.deprecations,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };

  if (bucket) {
    await bucket.put(PLATFORM_STATE_KEY, JSON.stringify(state, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  writeCache(state);
  return state;
}

export async function patchPlatformState(
  bucket: R2Bucket | undefined,
  updates: Partial<PlatformState>,
  expectedRevision?: number,
): Promise<PlatformState> {
  invalidatePlatformStateCache();
  const current = await readPlatformState(bucket);
  if (typeof expectedRevision === "number" && expectedRevision !== current.revision) {
    throw new PlatformStateConflictError(expectedRevision, current.revision);
  }
  const state: PlatformState = {
    features: normalizeFeatures({
      ...current.features,
      ...(updates.features as Partial<PlatformFeatures>),
    }),
    apiVersion: updates.apiVersion ?? getISODateString(),
    minClientVersion: updates.minClientVersion ?? current.minClientVersion,
    deprecations: normalizeDeprecations(updates.deprecations ?? current.deprecations),
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };

  if (bucket) {
    await bucket.put(PLATFORM_STATE_KEY, JSON.stringify(state, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  writeCache(state);
  return state;
}

export async function isFeatureEnabled(
  bucket: R2Bucket | undefined,
  key: keyof PlatformFeatures,
): Promise<boolean> {
  const state = await readPlatformState(bucket);
  return state.features[key];
}

// Version/date utilities
export function isVersionDateValid(dateString: string | undefined): boolean {
  if (!dateString) return true;
  // Check ISO date format YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

export function isDeprecatedPath(
  path: string,
  deprecations: Deprecation[],
): Deprecation | undefined {
  return deprecations.find((d) => d.path === path);
}

export function getDeprecationWarning(deprecation: Deprecation): string {
  const removedDate = new Date(deprecation.removedAt);
  const now = new Date();
  const daysUntilRemoval = Math.ceil(
    (removedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  let msg = `API endpoint "${deprecation.path}" will be removed on ${deprecation.removedAt}`;
  if (daysUntilRemoval > 0) {
    msg += ` (in ${daysUntilRemoval} days)`;
  } else {
    msg += " (ALREADY REMOVED, upgrade immediately)";
  }

  if (deprecation.alternative) {
    msg += `. Use "${deprecation.alternative}" instead.`;
  }

  if (deprecation.reason) {
    msg += ` Reason: ${deprecation.reason}`;
  }

  return msg;
}

export function parseSemVer(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

export function isClientVersionCompatible(
  clientVersion: string | undefined,
  minServerVersion: string | undefined,
): boolean {
  if (!minServerVersion || !clientVersion) return true;

  const client = parseSemVer(clientVersion);
  const server = parseSemVer(minServerVersion);

  if (!client || !server) return true; // If parse fails, assume compatible

  if (client.major !== server.major) {
    return client.major > server.major;
  }
  if (client.minor !== server.minor) {
    return client.minor > server.minor;
  }
  return client.patch >= server.patch;
}
