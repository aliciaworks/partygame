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
  deprecations?: any[];
  maintenance?: MaintenanceWindow;
  revision?: number;
  updatedAt?: string;
};

export type ModuleFlag = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

class PortalClient {
  private get baseUrl() {
    return localStorage.getItem(BACKEND_STORAGE_KEY) || DEFAULT_BACKEND_URL;
  }

  private get token() {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const headers = new Headers(options.headers);
    
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url.toString(), { ...options, headers });
    
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`API Error ${response.status}: ${errBody}`);
    }
    
    return response.json();
  }

  // --- Platform Settings ---
  
  async getPlatformState(): Promise<PlatformState> {
    return this.request<PlatformState>("/admin/platform");
  }

  async updatePlatformStateFull(updates: Partial<PlatformState>): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/admin/platform", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async updatePlatformState(updates: Partial<PlatformFeatures>): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/admin/platform/settings", {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  async getModules(): Promise<ModuleFlag[]> {
    return this.request<ModuleFlag[]>("/admin/modules");
  }

  // --- Players ---

  async getPlayers(limit = 50, cursor?: string): Promise<{ players: any[], cursor: string | null }> {
    return this.request<{ players: any[], cursor: string | null }>(`/admin/players?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);
  }

  async banPlayer(playerId: string, reason?: string, expiresAt?: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/players/${playerId}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason, expiresAt })
    });
  }

  async unbanPlayer(playerId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/admin/players/${playerId}/ban`, {
      method: "DELETE"
    });
  }

  // --- Operations (Hotfixes) ---

  async getHotfixes(): Promise<{ manifests: any[] }> {
    return this.request<{ manifests: any[] }>("/hotfix/list");
  }

  async uploadHotfix(formData: FormData): Promise<{ success: boolean, version: string }> {
    return this.request<{ success: boolean, version: string }>("/hotfix/upload", {
      method: "POST",
      body: formData
    });
  }

  async promoteHotfix(version: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/hotfix/promote/${version}`, {
      method: "POST"
    });
  }

  async rollbackHotfix(version: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/hotfix/rollback/${version}`, {
      method: "POST"
    });
  }

  // --- Utility ---
  
  logout() {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
}

export const portal = new PortalClient();
