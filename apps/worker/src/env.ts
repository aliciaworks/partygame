import type { PlatformState } from "./platform-state";

export type AppEnv = {
  Variables: {
    platformState: PlatformState;
    isAdmin: boolean;
  };
  Bindings: {
    PLATFORM_BUCKET?: R2Bucket;
    ADMIN_SECRET?: string;
    ADMIN_TOKEN?: string;
    PLAYER_SECRET?: string;
    GAME_ROOM?: DurableObjectNamespace;
    MATCHMAKER_ROOM?: DurableObjectNamespace;
    CHAT_ROOM?: DurableObjectNamespace;
    GUILD_ROOM?: DurableObjectNamespace;
    CALLS_APP_ID?: string;
    CALLS_APP_SECRET?: string;
    DB?: D1Database;
    MATCH_QUEUE?: Queue<any>;
    ANALYTICS?: AnalyticsEngineDataset;
    AI?: any;
    AUTH_RATE_LIMITER?: any;
    TURNSTILE_SECRET?: string;
    BETTER_AUTH_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
  };
};
