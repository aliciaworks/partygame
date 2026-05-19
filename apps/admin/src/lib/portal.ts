export const DEFAULT_BACKEND_URL = "https://partygame-example-backend.aliciaworks.workers.dev/";

export const BACKEND_STORAGE_KEY = "partygame.portal.backendUrl";
export const SITE_NAME_STORAGE_KEY = "partygame.portal.siteName";
export const DEFAULT_SITE_NAME = "PartyGame Portal";

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

export function readBackendUrl(): string {
  return normalizeBackendUrl(localStorage.getItem(BACKEND_STORAGE_KEY));
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

async function fetchJson<T>(backendUrl: string, path: string, init?: RequestInit): Promise<T> {
  let requestUrl: URL;
  try {
    requestUrl = new URL(path, backendUrl);
  } catch (err) {
    // try to salvage a URL if someone accidentally stored a labeled string
    const maybe = String(backendUrl).match(/https?:\/\/[^\s"']+/)?.[0];
    if (maybe) {
      try {
        requestUrl = new URL(path, maybe);
      } catch (err2) {
        throw new Error(`Invalid backend base URL: ${backendUrl}`);
      }
    } else {
      throw new Error(`Invalid backend base URL: ${backendUrl}`);
    }
  }

  const response = await fetch(requestUrl.toString(), {
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
    if (response.status === 404) {
      throw new Error(`Backend endpoint not found (404): ${requestUrl.toString()}`);
    }
    throw new Error(`Backend returned non-JSON response for ${requestUrl.toString()}. Check the backend URL or route.`);
  }

  if (!response.ok) {
    const error = (data as { error?: string }).error ?? `Request failed with ${response.status}`;
    throw new Error(error);
  }

  return data;
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
  roomId: string
): Promise<VoiceBootstrap> {
  return fetchJson<VoiceBootstrap>(backendUrl, `/api/voice/rooms/${encodeURIComponent(roomId)}/bootstrap`, {
    method: "POST",
  });
}