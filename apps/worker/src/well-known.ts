/**
 * /.well-known/agent-config.json — AI-agent discoverable manifest
 *
 * Describes how AI agents (Claude, Cursor, Copilot, etc.) interact with
 * PartyGame.  This endpoint requires NO authentication.
 */
export const AGENT_CONFIG = {
  engine: "partygame",
  version: "1.0.0",
  agentProtocols: {
    rest: {
      baseUrl: "https://your-worker.workers.dev",
      openApiSpec: "/openapi.json",
      authHeader: "Authorization",
      authScheme: "Bearer",
    },
    cli: {
      package: "@partygame/cli",
      command: "npx partygame",
    },
  },
  configEndpoints: {
    platform: {
      get: "GET /admin/platform",
      patch: "PATCH /admin/platform",
      features: "PATCH /admin/platform/features",
    },
    modules: "GET /admin/modules",
    assets: {
      list: "GET /admin/assets",
      create: "POST /admin/assets",
      delete: "DELETE /admin/assets/:id",
    },
    players: {
      list: "GET /admin/players",
      ban: "POST /admin/players/:id/ban",
      unban: "DELETE /admin/players/:id/ban",
    },
    hotfix: {
      list: "GET /hotfix/list",
      upload: "POST /hotfix/upload",
      promote: "POST /hotfix/promote/:version",
      rollback: "POST /hotfix/rollback/:version",
    },
  },
  featureFlags: {
    voiceChat: { type: "boolean", default: true },
    textChat: { type: "boolean", default: true },
    gameUpdates: { type: "boolean", default: true },
    matchmaking: { type: "boolean", default: true },
    leaderboard: { type: "boolean", default: true },
    friends: { type: "boolean", default: true },
    playerProfile: { type: "boolean", default: true },
    seasons: { type: "boolean", default: true },
    replays: { type: "boolean", default: true },
    guilds: { type: "boolean", default: true },
    watermark: { type: "boolean", default: false },
  },
};
