# PartyGame - A Serverless Game Backend Framework

An open-source, out-of-the-box Serverless Game Backend Framework built natively for Cloudflare Workers, Durable Objects, and D1. It is designed to bridge the gap between web-native infrastructure and traditional game engines (Unity, Godot, and Unreal Engine).

## Features

- **Authoritative GameRoom (`@partygame/core`)**: Built on `partyserver` (Cloudflare Durable Objects). Features a fixed tick-rate loop, server-authoritative anti-cheat movement validation, and an automatic Ping-Pong Keep-Alive mechanism to prevent stale connections.
- **ACID-Compliant Transactions (`@partygame/core/db`)**: Built with Drizzle ORM and Cloudflare D1. Features strict transactional logic for game inventory loops. Includes built-in **Idempotency Key** validation to prevent double-spending on network retries, and **Soft Deletes** for safe inventory management.
- **Game Identity (`@partygame/auth`)**: Powered by `better-auth`. Seamlessly bypasses cookie dependency, providing explicit stateless Session Token extraction for native game engines. Includes a dedicated Refresh Token bridge for persistent login states without relying on web cookies.
- **Cross-Engine Type Generation (`@partygame/shared`)**: Single source of truth. Define your networking models and database schemas in TypeScript (Zod), and automatically generate `C#` for Unity, `GDScript` for Godot, and `C++ Structs` for Unreal Engine simultaneously.
- **Security Middleware (`@partygame/core/middleware`)**: Built-in API Rate Limiting for Hono routes. **NEW**: Player-aware and room-aware rate limiting to prevent per-player/per-room flooding.
- **Structured Logging & Error Tracking**: Pino-based structured logging with Sentry integration support for production error tracking and incident response.
- **Comprehensive API Documentation**: Auto-generated OpenAPI 3.1 spec for all endpoints. Health checks, metrics, and SLA tracking for operational visibility.
- **Input Validation**: Zod-based request body and query parameter validation with security headers (CSP, HSTS, X-Frame-Options).

## Project Structure

This repository uses a native `npm` workspace monorepo structure:

### Core Packages
- `packages/core`: ECS framework (Entity, Component, System, World), game loop, network sync, movement validation.
- `packages/auth`: Better Auth integration and JWT token management.
- `packages/shared`: Zod schemas (single source of truth) and cross-engine code generation.

### Applications
- `apps/worker`: Cloudflare Workers backend - pure game server using ECS framework and WebSocket multiplayer.
- `apps/example-game`: Web frontend built with Babylon.js - multiplayer game collection (Arena Wars MOBA, CyberArena FPS).
- `apps/admin`: Admin control plane (SvelteKit + Cloudflare Pages).

### Generated Clients
- `clients/unity/`: Auto-generated C# types for Unity.
- `clients/godot/`: Auto-generated GDScript types for Godot.
- `clients/unreal/`: Auto-generated C++ types for Unreal Engine.

## Getting Started

### Backend Setup

```bash
npm install
npm run typecheck
```

Start the backend server:

```bash
cd apps/worker
npx wrangler dev
```

The backend runs on `http://localhost:8787` with:
- `POST /api/session/login` - Authenticate and get token
- `/ws` - WebSocket game connection
- `/rooms` - List active game rooms
- `/health` - Health check endpoint

### Frontend Setup

In a new terminal:

```bash
cd apps/example-game
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` with:
- Game launcher with game selection
- Arena Wars (3v3 MOBA-style battles)
- CyberArena (8-player FPS)

### Multi-Game Architecture

The example-game demonstrates how to build multiple games on the same backend:

```
apps/example-game/
  ├── src/
  │   ├── main.ts              # Game launcher & menu
  │   ├── core/
  │   │   ├── game-manager.ts  # Babylon.js scene setup
  │   │   ├── base-game.ts     # Abstract game class
  │   │   └── network-manager.ts # WebSocket client
  │   └── games/
  │       ├── moba/
  │       │   └── moba-game.ts # Arena Wars (3v3 battles)
  │       └── fps/
  │           └── fps-game.ts  # CyberArena (FPS)
```

**Key Points:**
- Each game extends `BaseGame` class
- Games use shared `NetworkManager` for server communication
- Babylon.js renders both 2D (MOBA) and 3D (FPS) games
- Same backend handles any number of game types

## Game Examples

### Arena Wars (MOBA)
- **Type**: 3v3 isometric team battles
- **Players**: Up to 6
- **Mechanics**: Top-down movement, team colors, health display
- **Rendering**: Babylon.js isometric camera with grid arena

### CyberArena (FPS)
- **Type**: Fast-paced first-person shooter
- **Players**: Up to 8
- **Mechanics**: FPS controls, jumping, sprinting, collision detection
- **Rendering**: Babylon.js 3D with neon environment, physics simulation

## Adding New Games

To add a new game type:

1. Create `src/games/your-game/your-game.ts`
2. Extend `BaseGame` class
3. Implement: `initialize()`, `start()`, `stop()`, `update()`, `processGameUpdate()`
4. Add game to menu in `main.ts`
5. Define custom components/systems in backend if needed

Example:

```typescript
import { BaseGame } from "../core/base-game";
import { NetworkManager } from "../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

export class MyGame extends BaseGame {
  async initialize(): Promise<void> {
    // Setup Babylon.js scene
  }
  
  start(): void {
    // Start game
  }
  
  update(): void {
    // Send inputs to server
  }
  
  processGameUpdate(update: GameTickUpdate): void {
    // Update game state from server
  }
}
   ```bash
   cd apps/admin
   npm run dev
   ```

## Deployment

### Worker backend

The worker entrypoint is the example game in [apps/example-game](apps/example-game). Deploy it with Wrangler from that directory:

```bash
cd apps/example-game
npm run deploy
```

Before deploying, make sure these values are set in `wrangler.toml`:

- `database_id` for your D1 database
- any Durable Object migration state you need for the current version

If you changed the Durable Object class name or schema, create and apply a new migration before deploying.

### Pages admin app

The admin UI lives in [apps/admin](apps/admin) and deploys separately as a Cloudflare Pages site:

```bash
cd apps/admin
npm run build
npx wrangler pages deploy build --project-name partygame-admin
```

If you have not created the Pages project yet, you can do that in the Cloudflare dashboard or let Wrangler create it the first time you deploy.

### Required environment values

The worker backend expects the following runtime bindings or secrets depending on which endpoints you use:

- `DB` for D1
- `GAME_ROOM` for the Durable Object binding
- `GOOGLE_CLIENT_ID` for native Google login
- `APPLE_CLIENT_ID` for native Apple login
- `AUTH_SESSION_SECRET` for the stateless session token signing key

## Quality Gates

Run these commands from the repository root before opening a pull request:

```bash
npm run generate:types
npm run typecheck
npm run lint
npm run test
npm run format
```

## Admin UI

The management interface now lives in [apps/admin](apps/admin). It is a separate SvelteKit workspace that is built for Pages-style deployment rather than the Worker runtime, so the control plane stays isolated from the game backend.

## Native Auth

The native login route now verifies real Google or Apple ID tokens. Set the corresponding client ID bindings in your Worker environment before using the `/api/auth/login/native` endpoint:

- `GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID`

The refresh endpoint is still intentionally conservative and returns `501` until a session lookup flow is wired in.

## Notes On Abuse Resistance

`@partygame/core` now includes stricter message parsing, movement validation, and purchase request validation. The current rate limiter is still in-memory and should be replaced with a distributed store for production deployments that span multiple isolates or regions.

## Phase 0 Engineering Improvements (v0.0.1)

### Observability

- **Structured Logging**: Pino-based logging with context propagation (request ID, room ID, player ID)
- **Error Tracking**: Sentry integration ready (set `SENTRY_DSN` env var in production)
- **Metrics Endpoint**: Prometheus `/metrics` endpoint for monitoring (uptime, active rooms, requests)
- **Health Checks**: Liveness (`/health`) and readiness (`/ready`) probes for load balancers
- **SLA Tracking**: `/sla` endpoint to monitor uptime vs. SLA targets

### Security

- **Enhanced Rate Limiting**: IP-based, player-based, and room-based rate limit buckets
- **Input Validation**: Zod schemas for all HTTP payloads with detailed error messages
- **Security Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Request Size Limits**: Maximum body size enforcement to prevent DoS
- **Rate Limit Response Headers**: `X-RateLimit-*` headers for client-side backoff

### Testing

- **Integration Tests**: Room lifecycle testing (join, move, disconnect, state sync)
- **Test Fixtures**: Reusable TestGameRoom class for future multiplayer tests
- **Chaos Testing Preparation**: Foundation for disconnect/network partition scenarios

### API Documentation

- **OpenAPI 3.1 Spec**: Machine-readable API definition in `@partygame/core/openapi.ts`
- **Endpoint Coverage**: Auth, Room, Inventory, Health, Metrics all documented
- **Schema Documentation**: Request/response schemas with validation rules
- **Error Code Catalog**: Standardized error responses (400, 401, 429, 503, etc.)

### Operations

- **Disaster Recovery Plan**: See [BACKUP_STRATEGY.md](BACKUP_STRATEGY.md) for backup procedures, recovery playbooks, and monthly DR drills
- **Database Snapshots**: Snapshot logic for Durable Object state recovery
- **Log Retention Strategy**: Audit logging for compliance (GDPR, SOC 2)

## Using Phase 0 Features

### Initialize Logging

```typescript
import { initializeLogger, createChildLogger } from "@partygame/core";

// At app startup
initializeLogger({
  isDev: process.env.ENV === "development",
  serviceName: "partygame-worker",
});

// In handlers
const logger = createChildLogger({ roomId, playerId, requestId });
logger.info({ event: "player_joined", playerId });
```

### Add Rate Limiting to Routes

```typescript
import { playerRateLimiter, roomRateLimiter } from "@partygame/core";

// Protect player endpoints
app.post("/api/purchase", playerRateLimiter, handlePurchase);

// Protect room endpoints
app.ws("/rooms/:id", roomRateLimiter, handleRoomSocket);
```

### Validate Inputs

```typescript
import { validateJsonBody, PurchaseRequestSchema } from "@partygame/core";

app.post(
  "/api/purchase",
  validateJsonBody(PurchaseRequestSchema),
  async (c) => {
    const body = c.get("validatedBody");
    // body is now type-safe: { itemId, quantity, playerId, idempotencyKey }
  }
);
```

### Health & Metrics

```bash
# Check service health
curl http://localhost:8787/health
# {"status":"healthy","timestamp":"2026-05-18T...","uptime_ms":12345}

# Prometheus metrics
curl http://localhost:8787/metrics
# partygame_uptime_ms 12345
# partygame_active_rooms 5
# partygame_active_players 42

# SLA status
curl http://localhost:8787/sla
# {"uptime_percent":99.95,"meets_sla":true,...}
```