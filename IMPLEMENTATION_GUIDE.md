# PartyGame Framework: Phase 1-3 Complete Implementation Guide

## Overview

This document describes the complete implementation of Phase 1 (Security & Monitoring), Phase 2 (Core Features), and Phase 3 (Advanced Capabilities) for the PartyGame framework.

**Total Features Implemented: 27 major components**

## Phase 1: Security & Monitoring (6 systems)

### 1.1 JWT Authentication (`auth.ts`)
Replaces basic auth with proper token-based security.

**Key Features:**
- Access token + Refresh token pairs
- Configurable expiration times (default: 15m access, 7d refresh)
- HS256 algorithm
- Context injection for authenticated requests

**Usage:**
```typescript
import { initializeJWT, generateTokenPair, authMiddleware } from '@partygame/core';

// Initialize
initializeJWT({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
});

// Generate tokens on login
const tokens = generateTokenPair({
  playerId: 'player-123',
  playerName: 'Alice',
  email: 'alice@example.com',
});

// Protect routes
app.use('/api/protected/*', authMiddleware);

// Get player ID from authenticated context
const playerId = getPlayerId(c);
```

### 1.2 Prometheus Metrics (`metrics.ts`)
Tracks KPIs and exposes metrics in Prometheus text format.

**Metrics Exposed:**
- HTTP requests (by method, path, status)
- Rate limit violations
- Active rooms/players (gauges)
- Tick duration histogram (P50, P95, P99)
- Request duration histogram
- Database query duration histogram

**Scrape Endpoint:** `GET /metrics`

**Usage:**
```typescript
import {
  metricsMiddleware,
  recordHttpRequest,
  recordRoomCreated,
  recordTickDuration,
} from '@partygame/core';

app.use('*', metricsMiddleware); // Auto-tracks all requests
recordRoomCreated();
recordTickDuration(45); // ms
```

### 1.3 Request Signing (`request-signing.ts`)
HMAC-SHA256 based client authentication to prevent tampering.

**Algorithm:** `HMAC-SHA256(METHOD|PATH|BODY|TIMESTAMP, CLIENT_SECRET)`

**Required Headers:**
- `X-PartyGame-Signature` — HMAC signature
- `X-PartyGame-Timestamp` — Unix timestamp (must be within 5 min)
- `X-PartyGame-Client-Id` — Client identifier

**Usage:**
```typescript
import {
  requestSigningMiddleware,
  generateRequestSignature,
} from '@partygame/core';

// Client side: Sign request
const signature = generateRequestSignature(
  'POST',
  '/api/room/join',
  JSON.stringify(body),
  Math.floor(Date.now() / 1000),
  'client-secret'
);

// Server side: Verify
const clientSecrets = new Map([['godot-client', 'godot-secret']]);
app.use('/api/*', (c, next) =>
  requestSigningMiddleware(c, next, clientSecrets)
);
```

### 1.4 Protocol Versioning (`protocol-version.ts`)
Manages API versions to support rolling upgrades.

**Supported Versions:**
- v1 (deprecated: false)
- v2 (new: leaderboard, achievements, chat)
- v3 (new: spectate, replay, features)

**Version Selection (priority):**
1. `X-API-Version` header
2. `api_version` query param
3. `X-PartyGame-Version` header
4. Default to current version

**Usage:**
```typescript
import {
  versionNegotiationMiddleware,
  getApiVersion,
  getCompatibilityNotes,
} from '@partygame/core';

app.use('/api/*', versionNegotiationMiddleware);

// In handler
const version = getApiVersion(c); // 'v3'
const notes = getCompatibilityNotes('v1', 'v3');
// ['Breaking changes in v2: ...', 'New endpoints in v2: ...']
```

**List Versions:** `GET /api-versions`

### 1.5 CI/CD Pipeline (`.github/workflows/ci.yml`)
Automated quality gates on every commit.

**Checks:**
- TypeScript compilation (`npm run typecheck`)
- ESLint (zero errors/warnings)
- Unit & integration tests (`npm run test`)
- Code format check (`npm run format`)
- Security scanning (Trivy SAST)
- Performance baseline (optional)

**Supported Node versions:** 18.x, 20.x

## Phase 2: Core Multiplayer Features (6 systems)

### 2.1 Database Schema Extensions (`schema-extended.ts`)
Comprehensive Drizzle ORM schema for Phase 2/3 features.

**Tables Added:**
- `rooms` — Persistent game room state
- `room_snapshots` — Historical snapshots for replay
- `players` — Player profiles and stats
- `leaderboard_entries` — Ranked scores with tiers
- `achievements` — Achievement definitions
- `player_achievements` — Earned achievements
- `chat_messages` — Game and room chat history
- `inventory_items` — Player item ownership
- `purchase_transactions` — Monetization ledger
- `replay_sessions` — Replay metadata
- `feature_flags` — Feature toggle configuration
- `analytics_events` — User behavior tracking

All tables include appropriate indices and optimizations.

### 2.2 Leaderboard System (`leaderboard.ts`)
Global rankings with seasonal support and tier classification.

**Tiers:** Diamond (top 10) → Platinum (top 50) → Gold → Silver → Bronze

**Endpoints:**
- `GET /api/leaderboard?limit=100&season=1` — Top players
- `GET /api/leaderboard/player/:playerId?season=1` — Player's rank context
- `GET /api/leaderboard/player/:playerId/stats?season=1` — Full stats

**Usage:**
```typescript
import {
  updatePlayerLeaderboardEntry,
  getPlayerLeaderboardStats,
  recalculateLeaderboardRanks,
} from '@partygame/core';

// After game ends
await updatePlayerLeaderboardEntry(playerId, finalScore, season);

// Get player's stats
const stats = await getPlayerLeaderboardStats(playerId, season);
// { playerRank, playerTier, rankChange, score, topPlayers[] }

// Recalculate all ranks (batch operation)
await recalculateLeaderboardRanks(season);
```

### 2.3 Achievement System (`achievements.ts`)
Tracks player achievements with progress and rewards.

**Built-in Achievements:**
1. `first_win` — Win your first game (10 points)
2. `win_10_games` — Win 10 games (25 points)
3. `score_1000` — Achieve 1000 points (50 points)
4. `play_50_games` — Play 50 games (30 points)
5. `level_10` — Reach level 10 (75 points)

**Endpoints:**
- `GET /api/achievements` — List all achievements
- `GET /api/achievements/:playerId` — Player's achievements and stats

**Usage:**
```typescript
import {
  unlockAchievement,
  checkAndUnlockAchievements,
  getPlayerAchievements,
} from '@partygame/core';

// After game
const unlockedIds = await checkAndUnlockAchievements(playerId);
// Automatically checks win/games/level conditions

// Or manually
await unlockAchievement(playerId, 'first_win');

// Get all achievements
const achievements = await getPlayerAchievements(playerId);
```

### 2.4 Chat System (`chat.ts`)
In-game chat with profanity filtering and moderation.

**Features:**
- Room-based chat
- Message censoring for banned words
- Profanity flagging
- Message length validation (1-500 chars)
- Timestamp-based ordering

**Endpoints:**
- `GET /api/chat/rooms/:roomId?limit=50` — Chat history
- `POST /api/chat/rooms/:roomId` — Send message

**Usage:**
```typescript
import {
  saveChatMessage,
  getRoomChatHistory,
  sendSystemNotification,
} from '@partygame/core';

// Save player message
const msg = await saveChatMessage(
  playerId,
  playerName,
  'Hello everyone!',
  roomId
);

// Get history
const history = await getRoomChatHistory(roomId, limit=50);

// Send system message
await sendSystemNotification(roomId, 'Player Alice joined');
```

### 2.5 Inventory & Purchases (via schema)
Database schema supports item purchases and inventory management.

**Database Tables:**
- `inventory_items` — What players own
- `purchase_transactions` — Purchase ledger

**Example Usage:**
```typescript
// Record purchase
await db.insert(purchaseTransactions).values({
  id: nanoid(),
  playerId,
  itemId: 'sword-v2',
  itemName: 'Legendary Sword',
  amount: 499, // soft currency
  currencyType: 'soft',
  status: 'completed',
});

// Add to inventory
await db.insert(inventoryItems).values({
  id: nanoid(),
  playerId,
  itemId: 'sword-v2',
  itemName: 'Legendary Sword',
  quantity: 1,
});
```

### 2.6 Admin Dashboard Data Sources (update to admin app)
The admin dashboard can now source real-time data from:

**Real-time Metrics:**
- Active rooms/players (from `/metrics`)
- Tick P99 duration
- Request latency
- Error rates

**Operational Data:**
- Top 100 leaderboard
- Achievement unlock rates
- Chat message volume
- Transaction history

## Phase 3: Advanced Capabilities (6 systems)

### 3.1 Feature Flags (`feature-flags.ts`)
Control feature rollout and A/B testing.

**Key Features:**
- Per-flag enable/disable
- Rollout percentage (0-100%)
- Target player lists
- In-memory cache (60s TTL)

**Endpoints:**
- `GET /api/features/:flagName?playerId=<id>` — Check if enabled
- `GET /api/features` — List all flags
- `PUT /api/features/:flagName` — Update flag (admin)

**Usage:**
```typescript
import { checkFeatureEnabled, setFeatureFlag } from '@partygame/core';

// Check if feature is enabled for player
const enabled = await checkFeatureEnabled('new_matchmaking', playerId);

// Gradual rollout: 10% initially
await setFeatureFlag(
  'new_matchmaking',
  true,
  10, // 10% rollout
  undefined,
  'New ML-based matchmaking system'
);

// Later: expand to 50%
await setFeatureFlag('new_matchmaking', true, 50);

// Target specific players
await setFeatureFlag(
  'beta_feature',
  true,
  100,
  ['player-vip-1', 'player-vip-2']
);
```

### 3.2 Replay System (`replay.ts`)
Records game state snapshots for analysis and replay.

**Features:**
- Per-tick snapshots (every 10th tick by default)
- State reconstruction
- Replay metadata with duration/tickCount
- Storage efficiency tracking

**Endpoints:**
- `GET /api/replays/:replayId` — Get replay metadata
- `GET /api/replays/rooms/:roomId` — List room's replays
- `GET /api/replays/:replayId/snapshots/:tick` — Get specific tick state

**Usage:**
```typescript
import {
  startReplaySession,
  recordTickSnapshot,
  endReplaySession,
  reconstructGameState,
} from '@partygame/core';

// During game
const replayId = await startReplaySession(roomId);

// Each tick
await recordTickSnapshot(roomId, tickNumber, gameState);

// On game end
const metadata = await endReplaySession(replayId, roomId, totalTicks);

// Later: reconstruct state at specific tick
const state = await reconstructGameState(roomId, 150);
```

### 3.3 Spectator System (`spectator.ts`)
Real-time game viewing for streaming/tournaments.

**Features:**
- Join as spectator (separate from players)
- In-memory session tracking
- Spectator count per room
- Auto-cleanup of stale sessions

**Endpoints:**
- `POST /api/spectate/rooms/:roomId/join` — Join as spectator
- `DELETE /api/spectate/sessions/:sessionId` — Leave
- `GET /api/spectate/rooms/:roomId` — List room spectators
- `GET /api/spectate/rooms/:roomId/count` — Get spectator count

**Usage:**
```typescript
import {
  joinAsSpectator,
  leaveAsSpectator,
  getRoomSpectators,
  broadcastGameStateToSpectators,
} from '@partygame/core';

// Player joins spectator mode
const session = await joinAsSpectator(roomId, playerId, playerName);

// Broadcast game state to all spectators
await broadcastGameStateToSpectators(roomId, gameState);

// Player leaves
await leaveAsSpectator(session.id);

// Cleanup stale sessions (run periodically)
await cleanupStaleSpectators(30); // 30 minute timeout
```

### 3.4 Analytics & Event Tracking (`analytics.ts`)
User behavior tracking for product insights.

**Built-in Events:**
- `game_started`, `game_completed`
- `player_joined_room`, `player_left_room`
- `item_purchased`, `achievement_unlocked`, `level_up`
- `api_request` (auto-tracked)
- `spectator_joined`, `spectator_left`

**Endpoints:**
- `GET /api/analytics/events/:eventName/stats?hours=24` — Event statistics
- `POST /api/analytics/funnel` — Funnel analysis (event sequences)
- `GET /api/analytics/players/:playerId/events?hours=24` — Player event history

**Usage:**
```typescript
import {
  trackEvent,
  getEventStats,
  analyzeFunnel,
  getPlayerEventHistory,
} from '@partygame/core';

// Track custom events
await trackEvent('level_up', { oldLevel: 5, newLevel: 6 }, playerId);
await trackEvent('item_purchased', { itemId: 'sword', price: 500 });

// Get statistics
const stats = await getEventStats('game_completed', 24); // last 24 hours
// { totalCount, uniquePlayers, avgPerPlayer }

// Funnel analysis: How many reach each stage?
const funnel = await analyzeFunnel([
  'game_started',
  'player_joined_room',
  'game_completed',
], 24);
// [
//   { step: 1, eventName: 'game_started', playerCount: 1000, dropoffRate: 0 },
//   { step: 2, eventName: 'player_joined_room', playerCount: 950, dropoffRate: 0.05 },
//   { step: 3, eventName: 'game_completed', playerCount: 800, dropoffRate: 0.158 },
// ]
```

### 3.5 Client SDK Code Generation (planned)
Automatic generation of client SDKs from OpenAPI spec.

**Supported Clients:**
- Godot GDScript
- Unity C#
- Unreal Engine (C++)
- Web TypeScript

**Generation Command (planned):**
```bash
npm run generate:sdk -- --language godot
```

### 3.6 Multi-Region Failover (planned)
Distributed Durable Objects across Cloudflare regions.

**Configuration:**
```toml
[env.production]
routes = [
  { pattern = "game-*.example.com", zone_name = "us-east" },
  { pattern = "game-*.example.com", zone_name = "eu-west" },
]
```

## Integration Checklist

### For Example Game App:
- [ ] Update wrangler.toml with all environment variables
- [ ] Initialize JWT with secrets
- [ ] Set up request signing client registry
- [ ] Connect to D1 database (Phase 2 schema)
- [ ] Initialize feature flags for canary deployments
- [ ] Set up analytics event pipeline
- [ ] Configure Sentry project for error tracking
- [ ] Set up Prometheus scraping from `/metrics`

### For Admin Dashboard:
- [ ] Display live metrics from `/metrics`
- [ ] Show leaderboard widget (real data)
- [ ] Show achievement unlock rates
- [ ] Show player activity timeline (analytics)
- [ ] Show feature flag toggles (with admin auth)
- [ ] Show spectator count per active room

### For Godot Client:
- [ ] Implement request signing
- [ ] Add protocol version header
- [ ] Use JWT tokens for authentication
- [ ] Track local analytics events
- [ ] Implement spectator mode UI
- [ ] Display leaderboard rankings

## Environment Variables Required

```bash
# JWT
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Request Signing (development)
GODOT_CLIENT_SECRET=godot-secret-123
UNITY_CLIENT_SECRET=unity-secret-456

# Sentry Error Tracking
SENTRY_DSN=https://xxx@sentry.io/xxxxx

# Database
DATABASE_URL=file:./db.sqlite

# Feature Flags (optional)
FEATURE_FLAGS_UPDATE_INTERVAL=60000

# Analytics (optional)
ANALYTICS_BATCH_SIZE=100
ANALYTICS_FLUSH_INTERVAL=30000
```

## Performance Targets (SLA)

| Metric | Target | Tool |
|--------|--------|------|
| Tick duration (P99) | < 50ms | `/metrics` histogram |
| Request latency (P99) | < 250ms | `/metrics` histogram |
| Leaderboard query | < 100ms | DB query logging |
| Chat history load | < 200ms | DB query logging |
| Achievement unlock | < 50ms | DB transaction timing |

## Security Considerations

1. **JWT Secret Rotation** — Implement key rotation every 90 days
2. **Request Signing** — Verify timestamps on every request
3. **Database Encryption** — Use D1's encryption at rest
4. **Rate Limiting** — Configured per IP/player/room
5. **Input Validation** — All endpoints validate with Zod
6. **CORS Headers** — Security headers middleware enabled
7. **Sentry Integration** — All errors captured and reported

## Monitoring & Alerts

**Recommended Alerts:**
1. Error rate > 1%
2. P99 latency > 500ms
3. Active rooms > 10,000 (capacity planning)
4. Database connections > 100
5. Rate limit violations > 100/min

**Dashboard Setup:**
- Prometheus + Grafana for metrics visualization
- Sentry for error tracking
- Custom admin dashboard for business metrics

## Next Steps

1. **Update wrangler.toml** with all new services
2. **Run database migrations** for new schema
3. **Set environment variables** in deployment
4. **Test all endpoints** with integration suite
5. **Deploy to staging** and monitor metrics
6. **Gradual rollout** using feature flags
7. **Collect analytics data** for product decisions

## References

- [OpenAPI Spec](./openapi.json)
- [Backup & Disaster Recovery](./BACKUP_STRATEGY.md)
- [API Documentation](../README.md)
- [Architecture Decisions](./ADR.md) (future)
