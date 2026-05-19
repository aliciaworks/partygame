import { writable } from 'svelte/store';
import type { PortalSession, SessionProfile, BackendHealth, BackendSla, ApiVersions, VoiceBootstrap } from './portal';

export const busy = writable(false);
export const statusMessage = writable('Loading portal...');
export const errorMessage = writable('');

export const backendUrl = writable('');
export const roomId = writable('control-room');
export const siteName = writable('');

export const session = writable<PortalSession | null>(null);
export const profile = writable<SessionProfile | null>(null);
export const health = writable<BackendHealth | null>(null);
export const sla = writable<BackendSla | null>(null);
export const versions = writable<ApiVersions | null>(null);
export const voiceBootstrap = writable<VoiceBootstrap | null>(null);
export const lastSyncedAt = writable('');

export function setError(message: string) {
  errorMessage.set(message);
}

export function clearError() {
  errorMessage.set('');
}
