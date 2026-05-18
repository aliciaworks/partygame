export const DEFAULT_BACKEND_URL = "https://partygame.aliciaworks.workers.dev";

export const BACKEND_STORAGE_KEY = "partygame.portal.backendUrl";
export const SESSION_STORAGE_KEY = "partygame.portal.session";
export const EMAIL_STORAGE_KEY = "partygame.portal.email";

export type PortalSession = {
  accessToken: string;
  refreshToken: string;
  playerId: string;
  playerName: string;
  voiceEnabled: boolean;
};

export type SessionProfile = {
  playerId: string;
  playerName: string;
  email: string | null;
  voiceEnabled: boolean;
  backendHealthy: boolean;
};

export type BackendHealth = {
  status: string;
  timestamp?: string;
  uptime_ms?: number;
  version?: string;
  message?: string;
  checks?: Record<string, boolean>;
};

export type BackendSla = {
  period?: string;
  uptime_percent?: number;
  error_rate_percent?: number;
  p99_latency_ms?: number;
  sla_target_uptime?: number;
  meets_sla?: boolean;
  last_incident?: string | null;
  incidents_30d?: number;
};

export type ApiVersions = {
  current: string;
  supported: string[];
  deprecated: string[];
};

export type VoiceBootstrap = {
  bootstrap: {
    provider: 'realtimekit';
    roomId: string;
    enabled: boolean;
    joinMode: 'client-managed';
    appId: string | null;
    joinHint: string;
  };
};

export function normalizeBackendUrl(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_BACKEND_URL;
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname === "/" ? "/" : `${parsed.pathname.replace(/\/+$/, "")}/`;
    return `${parsed.origin}${path}`;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

export function readPortalSession(): PortalSession | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PortalSession;
  } catch {
    return null;
  }
}

export function savePortalSession(session: PortalSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearPortalSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function readBackendUrl(): string {
  return normalizeBackendUrl(localStorage.getItem(BACKEND_STORAGE_KEY));
}

export function saveBackendUrl(backendUrl: string): string {
  const normalized = normalizeBackendUrl(backendUrl);
  localStorage.setItem(BACKEND_STORAGE_KEY, normalized);
  return normalized;
}

async function fetchJson<T>(backendUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl}${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: T;

  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch (parseError) {
    throw new Error(
      `Invalid JSON response from server: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. ` +
      `Response text: "${text.substring(0, 100)}"`
    );
  }

  if (!response.ok) {
    const error = (data as { error?: string }).error ?? `Request failed with ${response.status}`;
    throw new Error(error);
  }

  return data;
}

export async function loginToBackend(
  backendUrl: string,
  email: string,
  password: string
): Promise<PortalSession> {
  const data = await fetchJson<PortalSession & { playerId: string; playerName: string }>(backendUrl, "/api/session/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    playerId: data.playerId,
    playerName: data.playerName,
    voiceEnabled: data.voiceEnabled,
  };
}

export async function fetchSessionProfile(backendUrl: string, accessToken: string): Promise<SessionProfile> {
  return fetchJson<SessionProfile>(backendUrl, "/api/session/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function fetchBackendHealth(backendUrl: string): Promise<BackendHealth> {
  return fetchJson<BackendHealth>(backendUrl, "/health", { method: "GET" });
}

export async function fetchBackendSla(backendUrl: string): Promise<BackendSla> {
  return fetchJson<BackendSla>(backendUrl, "/sla", { method: "GET" });
}

export async function fetchApiVersions(backendUrl: string): Promise<ApiVersions> {
  return fetchJson<ApiVersions>(backendUrl, "/api-versions", { method: "GET" });
}

export async function fetchVoiceBootstrap(
  backendUrl: string,
  accessToken: string,
  roomId: string
): Promise<VoiceBootstrap> {
  return fetchJson<VoiceBootstrap>(backendUrl, `/api/voice/rooms/${encodeURIComponent(roomId)}/bootstrap`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}