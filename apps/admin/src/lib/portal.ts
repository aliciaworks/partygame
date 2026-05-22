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

export type PlatformState = {
  features: PlatformFeatures;
};

export type GameUpdateAsset = {
  key: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
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

export async function fetchPlatformState(
  backendUrl: string,
): Promise<PlatformState> {
  return adminFetch<PlatformState>(backendUrl, "/admin/platform");
}

export async function patchPlatformFeatures(
  backendUrl: string,
  updates: Partial<PlatformFeatures>,
): Promise<PlatformState> {
  return adminFetch<PlatformState>(backendUrl, "/admin/platform/features", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function listGameUpdates(
  backendUrl: string,
): Promise<{ assets: GameUpdateAsset[] }> {
  return adminFetch<{ assets: GameUpdateAsset[] }>(
    backendUrl,
    "/admin/game-updates",
  );
}

export async function uploadGameUpdate(
  backendUrl: string,
  file: File,
): Promise<{ asset: GameUpdateAsset }> {
  const form = new FormData();
  form.append("file", file);
  return adminFetch<{ asset: GameUpdateAsset }>(
    backendUrl,
    "/admin/game-updates",
    { method: "POST", body: form },
  );
}

export async function deleteGameUpdate(
  backendUrl: string,
  key: string,
): Promise<{ assets: GameUpdateAsset[] }> {
  return adminFetch<{ assets: GameUpdateAsset[] }>(
    backendUrl,
    `/admin/game-updates/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );
}

export async function downloadGameUpdate(
  backendUrl: string,
  key: string,
  fileName: string,
): Promise<void> {
  const token = readAdminToken();
  const url = new URL(
    `/admin/game-updates/${encodeURIComponent(key)}`,
    backendUrl,
  );
  const response = await fetch(url.toString(), {
    headers: { "X-Admin-Token": token },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
