# PartyGame Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
npm run typecheck  # Verify all code compiles
```

### 2. Configure Environment
Create `.env.local`:
```env
# Phase 1: Authentication
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Phase 1: Request Signing
GODOT_CLIENT_ID=godot-client
GODOT_CLIENT_SECRET=godot-secret-min-32-chars

# Database
DATABASE_URL=file:./db.sqlite

# Monitoring (optional)
SENTRY_DSN=https://xxx@sentry.io/xxxxx
METRICS_EXPORT_PORT=9090
```

### 3. Run Health Check
```bash
# In development with Wrangler:
wrangler dev

# Then test:
curl http://localhost:8787/health
```

---

## 📋 Phase 1 Usage Examples

### JWT Authentication
```typescript
import { initializeJWT, generateTokenPair, authMiddleware } from '@partygame/core';

// Initialize once on app startup
initializeJWT({
  secret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
});

// Apply to protected routes
app.use('/api/protected/*', authMiddleware);

// Generate tokens for login
const { accessToken, refreshToken } = generateTokenPair(playerId);

// Response: { accessToken: "eyJhbG...", refreshToken: "eyJhbG..." }
```

### Metrics Endpoint
```bash
# Prometheus format
curl http://localhost:8787/metrics

# Output:
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/health",status="200"} 42
http_requests_total{method="POST",path="/api/login",status="200"} 15
```

### Request Signing (Client Side)
```typescript
import { generateRequestSignature } from '@partygame/core';

const body = JSON.stringify({ roomId: '123', action: 'join' });
const signature = generateRequestSignature({
  method: 'POST',
  path: '/api/room/join',
  body,
  clientSecret: process.env.GODOT_CLIENT_SECRET!,
});

// Send request with headers:
// X-PartyGame-Signature: <signature>
// X-PartyGame-Timestamp: <timestamp>
// X-PartyGame-Client-Id: godot-client
```

### Protocol Version Negotiation
```bash
# Client specifies version
curl -H "X-API-Version: v2" http://localhost:8787/api/leaderboard

# Response includes version info:
{
  "apiVersion": "v2",
  "timestamp": "2026-05-18T12:34:56Z",
  "data": { "entries": [...] }
}
```

---

## 📊 Phase 2 Usage Examples (Once DB Integrated)

### Leaderboard Query
```bash
GET /api/leaderboard?season=1&limit=10

Response:
{
  "entries": [
    {
      "rank": 1,
      "playerId": "player-123",
      "score": 15000,
      "tier": "DIAMOND",
      "gamesWon": 45,
      "lastUpdated": "2026-05-18T10:30:00Z"
    },
    ...
  ]
}
```

### Achievement Check
```bash
GET /api/achievements?playerId=player-123

Response:
{
  "achievements": [
    {
      "id": "first_win",
      "name": "First Victory",
      "description": "Win your first game",
      "pointsReward": 10,
      "unlockedAt": "2026-05-15T14:22:00Z"
    },
    {
      "id": "win_10_games",
      "name": "Ten Wins",
      "progress": 7,  // out of 10
      "pointsReward": 25
    }
  ]
}
```

### Chat Message
```bash
POST /api/chat/rooms/room-123
Content-Type: application/json

{
  "playerId": "player-456",
  "message": "Great game everyone!"
}

Response:
{
  "messageId": "msg-789",
  "roomId": "room-123",
  "playerId": "player-456",
  "message": "Great game everyone!",
  "timestamp": "2026-05-18T12:34:56Z"
}
```

---

## 🔧 Phase 3 Features (Once DB Integrated)

### Check Feature Flag
```typescript
import { isFeatureEnabled } from '@partygame/core';

const hasNewUI = await isFeatureEnabled('new_ui_redesign', playerId);
if (hasNewUI) {
  // Show new interface
} else {
  // Show legacy interface
}
```

### Start Recording Replay
```typescript
import { startReplaySession, recordTickSnapshot } from '@partygame/core';

const replayId = await startReplaySession({
  roomId: 'room-123',
  players: ['p1', 'p2', 'p3'],
  gameMode: 'team_deathmatch',
});

// Every 10 ticks:
await recordTickSnapshot(replayId, {
  tick: 100,
  gameState: { positions: [...], scores: [...] },
});
```

### Track Analytics Event
```typescript
import { trackEvent } from '@partygame/core';

await trackEvent({
  eventType: 'item_purchased',
  playerId: 'player-123',
  metadata: {
    itemId: 'sword-legendary',
    price: 2999,
    currency: 'premium',
  },
});
```

### Enable Spectator Mode
```bash
POST /api/spectate/rooms/room-123/join
Content-Type: application/json

{
  "spectatorId": "viewer-456",
  "spectatorName": "Cool_Viewer"
}

Response:
{
  "sessionId": "session-789",
  "roomId": "room-123",
  "activePlayersCount": 4,
  "allowedUntil": "2026-05-18T13:34:56Z"
}
```

---

## 🧪 Testing the Endpoints

### Using cURL
```bash
# 1. Health check
curl http://localhost:8787/health

# 2. Get API versions
curl http://localhost:8787/api-versions

# 3. Get metrics (Prometheus format)
curl http://localhost:8787/metrics

# 4. Login and get tokens
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"playerId":"test-player"}'

# 5. Use token for protected route
curl http://localhost:8787/api/protected/profile \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Using Postman
1. Create collection "PartyGame API"
2. Add environment variables:
   - `base_url`: http://localhost:8787
   - `access_token`: (filled after login)
   - `client_secret`: (from .env)
3. Import requests from [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)

---

## 🔍 Debugging

### View TypeScript Errors
```bash
npm run typecheck 2>&1 | grep "error TS"
```

### Run Tests
```bash
npm run test
```

### Check Linting
```bash
npm run lint
```

### Format Code
```bash
npm run format
```

---

## 📚 File Structure

```
packages/core/src/
├── Phase 0 (Foundation)
│   ├── db.ts              # Database initialization
│   ├── error-handler.ts   # Error logging
│   ├── health.ts          # Health endpoints
│   ├── logger.ts          # Pino logging
│   ├── middleware.ts      # Rate limiting
│   ├── openapi.ts         # OpenAPI spec
│   ├── room.ts            # Room entity
│   ├── room-logic.ts      # Game logic
│   └── validation.ts      # Zod schemas
│
├── Phase 1 (Security)
│   ├── auth.ts            # JWT tokens
│   ├── metrics.ts         # Prometheus export
│   ├── request-signing.ts # HMAC-SHA256
│   └── protocol-version.ts # API versioning
│
├── Phase 2 (Features)
│   ├── schema-extended.ts # Database tables
│   ├── leaderboard.ts     # Ranking system
│   ├── achievements.ts    # Achievement system
│   └── chat.ts            # Game chat
│
├── Phase 3 (Advanced)
│   ├── feature-flags.ts   # Feature toggles
│   ├── replay.ts          # Game replay
│   ├── analytics.ts       # Event tracking
│   └── spectator.ts       # Spectator mode
│
└── index.ts               # Public exports
```

---

## 🎯 Common Tasks

### Add New Achievement
Edit `packages/core/src/achievements.ts`:
```typescript
const ACHIEVEMENTS = {
  'new_achievement': {
    name: 'New Achievement Name',
    description: 'Description',
    pointsReward: 50,
    condition: (playerData) => playerData.someMetric > threshold,
  },
};
```

### Change JWT Expiration
In `.env.local`:
```env
JWT_ACCESS_EXPIRY=30m   # Changed from 15m
JWT_REFRESH_EXPIRY=14d  # Changed from 7d
```

### Add Feature Flag
Once DB integrated:
```sql
INSERT INTO feature_flags (name, enabled, rollout_percentage)
VALUES ('new_feature', true, 50);  -- 50% of users
```

### Enable Error Tracking
```env
SENTRY_DSN=https://xxx@sentry.io/xxxxx
```

Then errors will be automatically tracked.

---

## ⚡ Performance Tips

1. **Metrics Query**: Filter by time range to reduce memory usage
   ```bash
   GET /metrics?since=1hour
   ```

2. **Leaderboard**: Use pagination for large datasets
   ```bash
   GET /api/leaderboard?limit=20&offset=100
   ```

3. **Chat History**: Limit message retrieval
   ```bash
   GET /api/chat/rooms/:id?limit=50&before=timestamp
   ```

4. **Analytics Export**: Run as background job
   ```bash
   POST /api/analytics/export?format=csv&hours=168
   ```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| TypeScript errors on startup | Run `npm install --legacy-peer-deps` |
| JWT signature fails | Verify `JWT_SECRET` is same across app instances |
| Metrics endpoint 404 | Check `/metrics` is registered in main app |
| Database queries fail | Verify schema-extended tables are created |
| Request signing fails | Check client secret matches in headers |

---

## 📖 Additional Resources

- [Full Implementation Guide](./IMPLEMENTATION_GUIDE.md)
- [Architecture Documentation](./IMPLEMENTATION_COMPLETE.md)
- [Phase 0 Completion](./PHASE_0_COMPLETE.md)
- [Backup Strategy](./BACKUP_STRATEGY.md)

---

**Ready to deploy? Follow the deployment checklist in IMPLEMENTATION_GUIDE.md!**
