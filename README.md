# PartyGame - A Serverless Game Backend Framework

An open-source, out-of-the-box Serverless Game Backend Framework built natively for Cloudflare Workers, Durable Objects, and D1. It is designed to bridge the gap between web-native infrastructure and traditional game engines (Unity, Godot, and Unreal Engine).

## Features

- **Authoritative GameRoom (`apps/worker/src/game`)**: Built directly into the Cloudflare Worker Durable Object runtime. Features a fixed tick-rate loop, server-authoritative movement validation, and per-room state isolation.
- **Worker-Owned Backend Runtime (`apps/worker`)**: The Worker owns room routing, WebSocket upgrades, public player sessions, and admin-only operations without a separate backend framework package.
- **Public Player Sessions**: Example clients can request lightweight session tokens through `/api/session/login`; admin and operations routes require `ADMIN_TOKEN`.
- **Cross-Engine Type Generation (`@partygame/shared`)**: Single source of truth. Define your networking models and database schemas in TypeScript (Zod), and automatically generate `C#` for Unity, `GDScript` for Godot, and `C++ Structs` for Unreal Engine simultaneously.
- **Operational Surface**: Health, SLA, room status, and admin room management endpoints are exposed from the Worker.

## Project Structure

This repository uses a native `npm` workspace monorepo structure:

### Shared Packages

- `packages/shared`: Zod schemas (single source of truth) and cross-engine code generation.

### Applications

- `apps/worker`: Cloudflare Workers backend with Durable Object room routing, local ECS runtime, public player sessions, and protected admin routes.
- `apps/example-game`: Web frontend built with Babylon.js - multiplayer game collection (Arena Wars MOBA, CyberArena FPS).
- `apps/admin`: Admin control plane (SvelteKit + Cloudflare Pages).

### Generated Engine Packages

- `engines/unity/`: Auto-generated C# types for Unity.
- `engines/godot/`: Auto-generated GDScript types for Godot.
- `engines/unreal/`: Auto-generated C++ types for Unreal Engine.

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
5. Define custom components/systems in `apps/worker/src/game` if needed

Example:

````typescript
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
````

## Deployment

### Worker backend

The worker entrypoint is [apps/worker](apps/worker). Deploy it with Wrangler from that directory:

```bash
cd apps/worker
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

- `GAME_ROOM` for the Durable Object binding
- `ADMIN_TOKEN` for `/admin/*` routes
- `CONTROLS_BUCKET`, `REALTIMEKIT_APP_ID`, and `REALTIMEKIT_API_TOKEN` only if using the optional admin/voice control helpers

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

## Notes On Abuse Resistance

The Worker keeps player sessions lightweight for public game access and protects admin operations with `ADMIN_TOKEN`. Add distributed rate limiting before exposing sensitive economy, inventory, or account mutation endpoints in production.

## Runtime Endpoints

```bash
# Check service health
curl http://localhost:8787/health
# {"status":"ok","timestamp":...,"activeRooms":0,"totalPlayers":0}

# List active rooms
curl http://localhost:8787/rooms
# {"rooms":[],"total":0}

# SLA status
curl http://localhost:8787/sla
# {"uptime_percent":99.95,"meets_sla":true,...}

# Admin room list
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8787/admin/rooms
```
