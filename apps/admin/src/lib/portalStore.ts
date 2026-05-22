import { writable } from "svelte/store";
import type {
  ApiVersions,
  BackendHealth,
  BackendSla,
  GameUpdateAsset,
  PlatformState,
} from "./portal";

export const busy = writable(false);
export const statusMessage = writable("");
export const errorMessage = writable("");

export const backendUrl = writable("");
export const siteName = writable("");
export const platformState = writable<PlatformState | null>(null);

export const health = writable<BackendHealth | null>(null);
export const sla = writable<BackendSla | null>(null);
export const versions = writable<ApiVersions | null>(null);
export const gameUpdates = writable<GameUpdateAsset[]>([]);
export const lastSyncedAt = writable("");

export function setError(message: string) {
  errorMessage.set(message);
  statusMessage.set("");
}

export function clearError() {
  errorMessage.set("");
}

export function setStatus(message: string) {
  statusMessage.set(message);
  errorMessage.set("");
}
