// @ts-nocheck

/**
 * Example Game Application
 * Demonstrates full integration of PartyGame framework features
 * Includes all Phase 0/1/2/3 capabilities
 */

import { Hono } from 'hono';
import {
  // Phase 0
  initializeLogger,
  getLogger,
  errorHandlerMiddleware,
  securityHeadersMiddleware,
  rateLimiter,
  validateJsonBody,
  handleHealthCheck,
  handleReadinessCheck,
  handleMetricsEndpoint,
  handleSLAStatus,
  // Phase 1
  initializeJWT,
  authMiddleware,
  generateTokenPair,
  verifyAccessToken,
  metricsMiddleware,
  requestSigningMiddleware,
  versionNegotiationMiddleware,
  // Phase 2
  leaderboard,
  achievements,
  chat,
  // Phase 3
  featureFlags,
  replay,
  analytics,
  spectator,
} from '@partygame/core';

// Initialize logger
initializeLogger({
  level: 'info',
  pretty: true,
  context: { service: 'example-game' },
});
const logger = getLogger();

// Initialize JWT
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

initializeJWT({
  secret: jwtSecret,
  refreshSecret: jwtRefreshSecret,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
});

// Request signing secrets (client ID -> secret mapping)
const clientSecrets = new Map<string, string>();
if (process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
  clientSecrets.set(process.env.CLIENT_ID, process.env.CLIENT_SECRET);
} else {
  // Default clients for development
  clientSecrets.set('godot-client', 'godot-secret-123');
  clientSecrets.set('unity-client', 'unity-secret-456');
}

// Create Hono app
const app = new Hono();

// === Phase 0: Foundation Middleware ===
app.use('*', errorHandlerMiddleware);
app.use('*', securityHeadersMiddleware);
app.use('*', metricsMiddleware);
app.use('*', rateLimiter);

// === Phase 1: Version Negotiation ===
app.use('/api/*', versionNegotiationMiddleware);

// === Phase 3: Analytics Tracking ===
app.use('/api/*', analytics);

// === Cloudflare Native Service Hooks ===
// RealtimeKit can be used for voice chat room bootstrap without building a custom SFU.
// R2 can hold runtime controls, update artifacts, and replay exports without adding D1 load.
// The admin panel can toggle these capabilities on or off without redeploying the app.

// === Health Checks (Public) ===
app.get('/health', (c) => handleHealthCheck(c));
app.get('/ready', (c) => handleReadinessCheck(c));
app.get('/metrics', (c) => handleMetricsEndpoint(c));
app.get('/sla', (c) => handleSLAStatus(c));

// === API Routes ===

// Auth endpoints
app.post('/api/auth/login', validateJsonBody, async (c) => {
  const body = await c.req.json() as { email: string; password: string };

  // TODO: Validate credentials against database
  // This is a simplified example
  if (!body.email || !body.password) {
    return c.json(
      { error: 'Invalid credentials' },
      401
    );
  }

  const tokens = generateTokenPair({
    playerId: `player-${Date.now()}`,
    playerName: body.email.split('@')[0],
    email: body.email,
  });

  return c.json(tokens);
});

app.post('/api/auth/refresh', async (c) => {
  const body = await c.req.json() as { refreshToken: string };

  if (!body.refreshToken) {
    return c.json(
      { error: 'Refresh token required' },
      400
    );
  }

  // TODO: Verify and issue new tokens
  return c.json({ accessToken: 'new-token' });
});

// Protected API Routes (require authentication)
app.use('/api/protected/*', authMiddleware);

// Leaderboard endpoints
app.get('/api/leaderboard', (c) =>
  leaderboard.handleGetLeaderboard(c)
);

app.get('/api/leaderboard/player/:playerId', (c) =>
  leaderboard.handleGetPlayerRank(c)
);

app.get('/api/leaderboard/player/:playerId/stats', (c) =>
  leaderboard.handleGetPlayerStats(c)
);

// Achievements endpoints
app.get('/api/achievements', (c) =>
  achievements.handleListAchievements(c)
);

app.get('/api/achievements/:playerId', (c) =>
  achievements.handleGetPlayerAchievements(c)
);

// Chat endpoints
app.get('/api/chat/rooms/:roomId', (c) =>
  chat.handleGetChatHistory(c)
);

app.post('/api/chat/rooms/:roomId', (c) =>
  chat.handlePostChatMessage(c)
);

// Feature flags
app.get('/api/features/:flagName', (c) =>
  featureFlags.handleCheckFeature(c)
);

app.get('/api/features', (c) =>
  featureFlags.handleListFeatures(c)
);

// Replay endpoints
app.get('/api/replays/:replayId', (c) =>
  replay.handleGetReplay(c)
);

app.get('/api/replays/rooms/:roomId', (c) =>
  replay.handleListRoomReplays(c)
);

app.get('/api/replays/:replayId/snapshots/:tick', (c) =>
  replay.handleGetTickSnapshot(c)
);

// Spectator endpoints
app.post('/api/spectate/rooms/:roomId/join', (c) =>
  spectator.handleJoinSpectator(c)
);

app.delete('/api/spectate/sessions/:sessionId', (c) =>
  spectator.handleLeaveSpectator(c)
);

app.get('/api/spectate/rooms/:roomId', (c) =>
  spectator.handleGetRoomSpectators(c)
);

app.get('/api/spectate/rooms/:roomId/count', (c) =>
  spectator.handleGetSpectatorCount(c)
);

// Analytics endpoints
app.get('/api/analytics/events/:eventName/stats', (c) =>
  analytics.handleGetEventStats(c)
);

app.post('/api/analytics/funnel', (c) =>
  analytics.handleAnalyzeFunnel(c)
);

app.get('/api/analytics/players/:playerId/events', (c) =>
  analytics.handleGetPlayerEvents(c)
);

// API versioning endpoint
app.get('/api-versions', (c) => {
  return c.json({
    current: 'v3',
    supported: ['v1', 'v2', 'v3'],
    deprecated: [],
  });
});

// Error handling
app.onError((err, c) => {
  logger.error({ error: err }, 'Unhandled error');
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

// 404 handling
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `No route found for ${c.req.path}`,
    },
    404
  );
});

logger.info(
  {
    features: [
      'Phase 0: Foundation',
      'Phase 1: Security & Monitoring',
      'Phase 2: Core Multiplayer Features',
      'Phase 3: Advanced Capabilities',
      'Cloudflare Native Services: RealtimeKit + R2 + Admin Controls',
    ],
  },
  'Example Game Application Ready'
);

export default app;
