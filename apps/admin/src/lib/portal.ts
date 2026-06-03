export const DEFAULT_BACKEND_URL =
  "https://partygame-example-backend.aliciaworks.workers.dev/";

export const BACKEND_STORAGE_KEY = "partygame.portal.backendUrl";
export const ADMIN_TOKEN_STORAGE_KEY = "partygame.portal.adminToken";
export const SITE_NAME_STORAGE_KEY = "partygame.portal.siteName";
export const DEFAULT_SITE_NAME = "PartyGame Admin";

export type PlatformFeatures = {
  voiceChat: boolean;
  textChat: boolean;
  gameUpdates: boolean;
  matchmaking: boolean;
  leaderboard: boolean;
  friends: boolean;
  playerProfile: boolean;
};

export type MaintenanceWindow = {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
  message?: string;
};

export type PlatformState = {
  features: PlatformFeatures;
  apiVersion?: string;
  minClientVersion?: string;
  deprecations?: Array<{ path: string; removedAt: string; alternative?: string; reason?: string }>;
  maintenance?: MaintenanceWindow;
  revision?: number;
  updatedAt?: string;
};

export type GameUpdateAsset = {
  version: string;
  gameVersionMin: string;
  files: string[];
  checksum: string;
  uploadedAt: string;
};

export type ModuleFlag = {
  key: string;
  label: string;
  type: string;
  default: boolean | number | string | string[];
  description?: string;
  options?: string[];
};

export type ModuleNavItem = {
  label: string;
  page: string;
};

export type ModuleManifest = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  nav?: ModuleNavItem[];
  flags?: ModuleFlag[];
};

export type ModuleSummary = ModuleManifest & {
  enabled: boolean;
};

export type PlayerBan = {
  playerId: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  expiresAt?: string;
};

export type PlayerAccount = {
  playerId: string;
  playerName: string;
  createdAt: string;
  lastSeen: string;
  banned: boolean;
};

export type PlayerDetail = {
  account: PlayerAccount;
  ban: PlayerBan | null;
  progress: unknown;
};

export type AuditRecord = {
  action: string;
  targetPlayerId?: string;
  adminId: string;
  detail: string;
  timestamp: string;
};

export type HotfixList = {
  versions: GameUpdateAsset[];
  latest: string | null;
};

export type BackendHealth = {
  status: string;
  timestamp?: number;
  activeRooms?: number;
  totalPlayers?: number;
};

export type BackendSla = {
  period?: string;
  uptime_percent?: number;
  error_rate_percent?: number;
  meets_sla?: boolean;
};

export type ApiVersions = {
  current: string;
  supported: string[];
  deprecated: string[];
};

export const FEATURE_META: Record<
  keyof PlatformFeatures,
  { labelKey: string; descKey: string }
> = {
  voiceChat: { labelKey: "features.voiceChat", descKey: "features.voiceChatDesc" },
  textChat: { labelKey: "features.textChat", descKey: "features.textChatDesc" },
  gameUpdates: { labelKey: "features.gameUpdates", descKey: "features.gameUpdatesDesc" },
  matchmaking: { labelKey: "features.matchmaking", descKey: "features.matchmakingDesc" },
  leaderboard: { labelKey: "features.leaderboard", descKey: "features.leaderboardDesc" },
  friends: { labelKey: "features.friends", descKey: "features.friendsDesc" },
  playerProfile: { labelKey: "features.playerProfile", descKey: "features.playerProfileDesc" },
};

export function normalizeBackendUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_BACKEND_URL;

  try {
    const parsed = new URL(trimmed);
    const path =
      parsed.pathname === "/" ? "/" : `${parsed.pathname.replace(/\/+$/, "")}/`;
    return `${parsed.origin}${path}`;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export function readBackendUrl(): string {
  return normalizeBackendUrl(localStorage.getItem(BACKEND_STORAGE_KEY));
}

export function readAdminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

export function saveAdminToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
  return trimmed;
}

export function readSiteName(): string {
  const v = localStorage.getItem(SITE_NAME_STORAGE_KEY);
  return v?.trim() || DEFAULT_SITE_NAME;
}

export function saveSiteName(name: string): string {
  const trimmed = name?.trim() || DEFAULT_SITE_NAME;
  localStorage.setItem(SITE_NAME_STORAGE_KEY, trimmed);
  return trimmed;
}

export function saveBackendUrl(backendUrl: string): string {
  const normalized = normalizeBackendUrl(backendUrl);
  localStorage.setItem(BACKEND_STORAGE_KEY, normalized);
  return normalized;
}

async function fetchJson<T>(
  backendUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const requestUrl = new URL(path, backendUrl);
  const response = await fetch(requestUrl.toString(), init);
  const text = await response.text();
  let data = {} as T;

  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(`Non-JSON response (${response.status})`);
    }
  }

  if (!response.ok) {
    const error =
      (data as { error?: string }).error ??
      `Request failed with ${response.status}`;
    throw new Error(error);
  }

  return data;
}

export async function adminFetch<T>(
  backendUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readAdminToken();
  if (!token) {
    throw new Error("Admin token is required. Add it in Settings.");
  }

  return fetchJson<T>(backendUrl, path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "X-Admin-Token": token,
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
  });
}

export async function fetchBackendHealth(
  backendUrl: string,
): Promise<BackendHealth> {
  return fetchJson<BackendHealth>(backendUrl, "/health");
}

export async function fetchBackendSla(backendUrl: string): Promise<BackendSla> {
  return fetchJson<BackendSla>(backendUrl, "/sla");
}

export async function fetchApiVersions(
  backendUrl: string,
): Promise<ApiVersions> {
  return fetchJson<ApiVersions>(backendUrl, "/api-versions");
}

export async function fetchModules(
  backendUrl: string,
): Promise<{ modules: ModuleSummary[] }> {
  return adminFetch<{ modules: ModuleSummary[] }>(backendUrl, "/admin/modules");
}

export async function fetchModuleManifest(
  backendUrl: string,
  moduleId: string,
): Promise<ModuleManifest> {
  return adminFetch<ModuleManifest>(
    backendUrl,
    `/admin/modules/${encodeURIComponent(moduleId)}/manifest`,
  );
}

export async function fetchPlayers(
  backendUrl: string,
  limit = 50,
  cursor?: string,
): Promise<{ players: PlayerAccount[]; cursor: string | null }> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return adminFetch<{ players: PlayerAccount[]; cursor: string | null }>(
    backendUrl,
    `/admin/players?${query.toString()}`,
  );
}

export async function fetchPlayerDetail(
  backendUrl: string,
  playerId: string,
): Promise<PlayerDetail> {
  return adminFetch<PlayerDetail>(
    backendUrl,
    `/admin/players/${encodeURIComponent(playerId)}`,
  );
}

export async function banPlayer(
  backendUrl: string,
  playerId: string,
  reason?: string,
  expiresAt?: string,
): Promise<{ success: true; ban: PlayerBan }> {
  return adminFetch<{ success: true; ban: PlayerBan }>(
    backendUrl,
    `/admin/players/${encodeURIComponent(playerId)}/ban`,
    {
      method: "POST",
      body: JSON.stringify({ reason, expiresAt }),
    },
  );
}

export async function kickPlayer(
  backendUrl: string,
  playerId: string,
): Promise<{ success: true }> {
  return adminFetch<{ success: true }>(
    backendUrl,
    `/admin/players/${encodeURIComponent(playerId)}/kick`,
    { method: "POST" },
  );
}

export async function unbanPlayer(
  backendUrl: string,
  playerId: string,
): Promise<{ success: true }> {
  return adminFetch<{ success: true }>(
    backendUrl,
    `/admin/players/${encodeURIComponent(playerId)}/ban`,
    { method: "DELETE" },
  );
}

export async function fetchAuditRecords(
  backendUrl: string,
  limit = 50,
  cursor?: string,
): Promise<{ records: AuditRecord[]; cursor: string | null }> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return adminFetch<{ records: AuditRecord[]; cursor: string | null }>(
    backendUrl,
    `/admin/audit?${query.toString()}`,
  );
}

export async function listHotfixes(
  backendUrl: string,
): Promise<HotfixList> {
  return adminFetch<HotfixList>(backendUrl, "/hotfix/list");
}

export async function uploadHotfix(
  backendUrl: string,
  file: File,
  version?: string,
  gameVersionMin?: string,
): Promise<{ manifest: GameUpdateAsset }> {
  const form = new FormData();
  form.append("file", file);
  if (version) form.append("version", version);
  if (gameVersionMin) form.append("gameVersionMin", gameVersionMin);
  return adminFetch<{ manifest: GameUpdateAsset }>(backendUrl, "/hotfix/upload", {
    method: "POST",
    body: form,
  });
}

export async function promoteHotfix(
  backendUrl: string,
  version: string,
): Promise<{ success: true; latest: string }> {
  return adminFetch<{ success: true; latest: string }>(
    backendUrl,
    `/hotfix/promote/${encodeURIComponent(version)}`,
    { method: "POST" },
  );
}

export async function rollbackHotfix(
  backendUrl: string,
  version: string,
): Promise<{ success: true; latest: string }> {
  return adminFetch<{ success: true; latest: string }>(
    backendUrl,
    `/hotfix/rollback/${encodeURIComponent(version)}`,
    { method: "POST" },
  );
}

export async function deleteHotfix(
  backendUrl: string,
  version: string,
): Promise<{ success: true }> {
  return adminFetch<{ success: true }>(
    backendUrl,
    `/hotfix/${encodeURIComponent(version)}`,
    { method: "DELETE" },
  );
}

export async function downloadHotfix(
  backendUrl: string,
  version: string,
): Promise<void> {
  const token = readAdminToken();
  const url = new URL(`/hotfix/${encodeURIComponent(version)}/patch`, backendUrl);
  const response = await fetch(url.toString(), {
    headers: { "X-Admin-Token": token },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${version}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function fetchPlatformState(
  backendUrl: string,
): Promise<PlatformState> {
  return adminFetch<PlatformState>(backendUrl, "/admin/platform");
}

export async function patchPlatformFeatures(
  backendUrl: string,
  updates: Partial<PlatformFeatures>,
  expectedRevision?: number,
): Promise<PlatformState> {
  return adminFetch<PlatformState>(backendUrl, "/admin/platform/features", {
    method: "PATCH",
    headers: expectedRevision === undefined ? undefined : { "If-Match": String(expectedRevision) },
    body: JSON.stringify(updates),
  });
}

export async function patchPlatformState(
  backendUrl: string,
  updates: Partial<PlatformState>,
  expectedRevision?: number,
): Promise<PlatformState> {
  return adminFetch<PlatformState>(backendUrl, "/admin/platform", {
    method: "PATCH",
    headers: expectedRevision === undefined ? undefined : { "If-Match": String(expectedRevision) },
    body: JSON.stringify(updates),
  });
}

export async function listGameUpdates(
  backendUrl: string,
): Promise<{ assets: GameUpdateAsset[] }> {
  const list = await listHotfixes(backendUrl);
  return { assets: list.versions };
}

export async function uploadGameUpdate(
  backendUrl: string,
  file: File,
): Promise<{ asset: GameUpdateAsset }> {
  const result = await uploadHotfix(backendUrl, file);
  return { asset: result.manifest };
}

export async function deleteGameUpdate(
  backendUrl: string,
  key: string,
): Promise<{ assets: GameUpdateAsset[] }> {
  await deleteHotfix(backendUrl, key);
  return listGameUpdates(backendUrl);
}

export async function downloadGameUpdate(
  backendUrl: string,
  key: string,
  fileName: string,
): Promise<void> {
  await downloadHotfix(backendUrl, key);
}
