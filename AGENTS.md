# AGENTS.md - PartyGame Architecture & Design Guide

This document is designed for AI agents and developers to quickly understand the PartyGame project structure, goals, and architecture.

## Executive Summary

**PartyGame** is an open-source, **game-engine-agnostic serverless game backend framework** built on Cloudflare Workers, Durable Objects, and D1. It enables developers to build games of **any type** (FPS, MOBA, RPG, puzzle, card games, etc.) and deploy them to **any engine** (Unity, Godot, Unreal Engine, or Web/Browser).

**Key Insight**: Game logic is written once in TypeScript/ECS on the server, and client types (C#, GDScript, C++, JSON) are automatically generated. This eliminates code duplication across game engines.

---

## Core Philosophy

### 1. **Server-Authoritative** (Anti-Cheat)

- Game state and logic validation happen exclusively on the server
- Clients send **inputs only** (position, action, ability, etc.), never state
- Server validates moves within physics constraints, ability cooldowns, etc.
- Prevents client-side cheating and provides fair gameplay

### 2. **Engine-Agnostic**

- Server logic is written once in TypeScript
- Client types are auto-generated for all supported engines
- Same game can run in Unity, Godot, Unreal, and Web without modification
- Clients differ only in rendering and input handling

### 3. **Serverless-First**

- Built on Cloudflare Workers (global edge compute) and Durable Objects (stateful multiplayer)
- No traditional game server management
- Auto-scaling, zero cold starts (with smart preflight)
- Pay only for what you use

### 4. **Type-Safe Cross-Engine Sync**

- Single source of truth: Zod schemas define both network messages and database models
- Auto-generate C#, GDScript, C++ structures for client engines
- All clients and servers speak the same language

---

## Game Architecture Paradigm: ECS (Entity-Component-System)

PartyGame uses **ECS** to support games of any type and complexity.

### Why ECS?

1. **Universality**: Works for FPS (entities = players/bullets), MOBA (units/towers), RPG (characters/NPCs), puzzle (blocks/gems), etc.
2. **Modularity**: New game mechanics added as new Systems without touching existing code
3. **Hot-Reloading**: Systems can be replaced/updated at runtime (critical for live ops and quick iterations)
4. **Network Efficiency**: Component-based serialization allows fine-grained state diffs
5. **Performance**: Cache-friendly iteration over entity components

### Core ECS Concepts

```
Entity
  └─ Components (Transform, Health, Inventory, Status, etc.)

World
  ├─ All Entities
  └─ All Systems (MovementSystem, CombatSystem, AbilitySystem, etc.)

Game Loop (Fixed 20 Hz tick)
  1. Collect inputs from all connected players
  2. Run Systems in order (Physics → Combat → Abilities → Animation)
  3. Compute state deltas (what changed)
  4. Broadcast diffs to clients
  5. Persist state to D1
```

### Client-Side Game Architecture

**Babylon.js Rendering Framework:**

- Unified 2D and 3D rendering across all games
- Physics engine integration (Cannon.js)
- GUI system for HUDs and menus
- Scene management and camera controls

**Game Classes (extend BaseGame):**

```typescript
BaseGame
├── MOBAGame       // 3v3 isometric arena battles
├── FPSGame        // 8-player first-person shooter
└── [Your Game]    // Custom game type
```

Each game:

- Initializes unique scene and UI
- Handles input for specific game mechanics
- Processes server game state updates
- Renders entities using Babylon.js

### Current Implementation vs. Planned State

**Current** (`apps/example-game/`):

- MOBA game: Isometric 2D arena with player movement and health display
- FPS game: 3D first-person with collision and neon environment
- Game launcher with menu and game selection
- WebSocket networking with auto-reconnect

**Planned Extensions**:

- Roguelike dungeon crawler (2D procedural generation)
- Turn-based strategy game (grid-based combat)
- Battle royale (large map, survival mechanics)
- Racing game (vehicle physics, waypoint navigation)

---

## Project Structure (Monorepo)

```
partygame/
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas.ts             # Zod schemas (single source of truth)
│       │   ├── typegen.ts             # Code generation logic
│       │   └── index.ts
│       └── scripts/
│           └── generate-types.ts      # CLI script
│
├── apps/
│   ├── worker/
│   │   ├── src/
│   │   │   ├── index.ts               # Hono worker entrypoint and Durable Object routing
│   │   │   ├── game/
│   │   │   │   ├── ecs/               # Entity, component, system, world
│   │   │   │   ├── components/        # Transform, health, velocity, input
│   │   │   │   ├── systems/           # Movement and future game systems
│   │   │   │   ├── room-game.ts       # RoomGame with ECS world
│   │   │   │   └── game-loop.ts       # 20 Hz game loop scheduler
│   │   │   └── platform-controls.ts   # Feature flags
│   │   ├── wrangler.toml              # Cloudflare config
│   │   └── package.json
│   │
│   ├── example-game/
│   │   ├── src/
│   │   │   ├── main.ts                # Game launcher & menu
│   │   │   ├── core/
│   │   │   │   ├── game-manager.ts    # Babylon.js scene setup
│   │   │   │   ├── base-game.ts       # Abstract game class
│   │   │   │   └── network-manager.ts # WebSocket client
│   │   │   └── games/
│   │   │       ├── moba/
│   │   │       │   └── moba-game.ts   # Arena Wars (3v3)
│   │   │       └── fps/
│   │   │           └── fps-game.ts    # CyberArena (FPS)
│   │   ├── index.html                 # Game launcher UI
│   │   ├── vite.config.ts             # Vite build config with worker proxy
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── admin/
│       ├── src/
│       │   ├── routes/                # SvelteKit routes
│       │   ├── lib/                   # Reusable components
│       │   └── app.html
│       ├── svelte.config.js
│       └── vite.config.ts
│
├── engines/
│   ├── unity/                         # Auto-generated C# types
│   ├── godot/                         # Auto-generated GDScript types
│   └── unreal/                        # Auto-generated C++ structs
│
├── AGENTS.md                          # This file
└── README.md
```

---

## Key Concepts for Development

### 1. **Zod Schemas** (Single Source of Truth)

All shared data types are defined once in `packages/shared/src/schemas.ts`:

```typescript
// This Zod schema is the source of truth
export const TransformSchema = z.object({
  position: z.object({ x: z.number(), y: z.number() }),
  rotation: z.number(),
  scale: z.object({ x: z.number(), y: z.number() }),
});

// Automatically generates:
// - TypeScript types (Web/Node)
// - C# classes (Unity)
// - GDScript classes (Godot)
// - C++ structs (Unreal)
```

### 2. **Component Structure**

```typescript
// apps/worker/src/game/components/index.ts
export class HealthComponent {
  readonly type = "health";
  hp: number = 100;
  maxHp: number = 100;
  isDead: boolean = false;

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    this.isDead = this.hp === 0;
  }
}
```

### 3. **System Structure**

```typescript
// apps/worker/src/game/systems/combat.ts
export class CombatSystem extends System {
  update(world: World, deltaMs: number) {
    for (const entity of world.entities.values()) {
      const health = entity.getComponent("health");
      const damage = entity.getComponent("damage");

      if (health && damage) {
        health.takeDamage(damage.pending);
        damage.pending = 0; // Reset after application
      }
    }
  }
}
```

### 4. **Server-Authoritative Input Handling**

Client sends raw input, server validates and applies:

```typescript
// Client sends
{
  type: "MOVE",
  targetX: 100,
  targetY: 200,
}

// Server validates
if (isMoveWithinBounds(currentPos, targetPos)) {
  entity.getComponent('transform').position = targetPos;
  broadcastDelta(entity.id, 'transform', newTransform);
}
```

### 5. **Network Protocol**

Every message is versioned for backward compatibility:

```typescript
{
  v: 1,                    // Protocol version
  tick: 1024,              // Server tick number
  entities: {
    "player-1": {
      transform: { x: 50, y: 100, rotation: 0 },
      health: { hp: 80 }
    }
  },
  events: [
    { type: "damage_taken", entityId: "player-1", amount: 20 }
  ]
}
```

---

## Game Types Supported (Examples)

### Arena Wars (MOBA) - ✅ IMPLEMENTED

- **Type**: 3v3 isometric team battles
- **Entities**: Players (6 max)
- **Systems**: Movement (isometric), TeamColorSystem
- **Client**: Babylon.js isometric camera with grid arena
- **Status**: Fully functional with multiplayer support

### CyberArena (FPS) - ✅ IMPLEMENTED

- **Type**: 8-player first-person shooter
- **Entities**: Players, obstacles, neon environment
- **Systems**: Movement (FPS), collision detection, jumping
- **Client**: Babylon.js 3D with physics, mouse look, sprint
- **Status**: Fully functional with multiplayer support

### Roguelike Dungeon Crawler - PLANNED

- **Type**: Single-player or co-op 2D dungeon crawler
- **Entities**: Player, enemies, items, dungeon tiles
- **Systems**: Movement, AISystem, LootSystem, DungeonGenerator
- **Example**: Diablo-like or classic roguelike

### Turn-Based Strategy - PLANNED

- **Type**: Grid-based tactical combat
- **Entities**: Units, structures, terrain tiles
- **Systems**: TurnSystem, ActionSystem, PathfindingSystem
- **Example**: Fire Emblem or Tactics Ogre style

### Battle Royale - PLANNED

- **Type**: Large-scale survival (up to 100 players)
- **Entities**: Players, loot, vehicles, zone
- **Systems**: ZoneSystem, LootDistributionSystem, VehicleSystem
- **Example**: Fortnite or Apex Legends style

### Racing Game - PLANNED

- **Type**: Vehicle-based racing
- **Entities**: Vehicles, track, checkpoints
- **Systems**: VehiclePhysicsSystem, RaceProgressSystem
- **Example**: Mario Kart or Gran Turismo style

---

## Development Workflow

### Phase 1: Backend Setup

```bash
# Install dependencies
npm install

# Start worker backend
cd apps/worker
npx wrangler dev
# Backend runs on http://localhost:8787
```

### Phase 2: Frontend Setup

```bash
cd apps/example-game
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

### Phase 3: Create a New Game

1. Create game file: `src/games/your-game/your-game.ts`
2. Extend `BaseGame` class:

```typescript
import { BaseGame } from "../core/base-game";
import { NetworkManager } from "../core/network-manager";
import type { GameTickUpdate } from "@partygame/shared";

export class YourGame extends BaseGame {
  async initialize(): Promise<void> {
    // Setup Babylon.js scene
  }

  start(): void {
    // Start game loop
  }

  update(): void {
    // Send player input
    this.networkManager.sendInput(moveX, moveY, isSprinting, isJumping);
  }

  processGameUpdate(update: GameTickUpdate): void {
    // Handle server state updates
  }
}
```

3. Add to menu in `main.ts`
4. Register game card in HTML

### Phase 4: Backend Game Logic (if needed)

1. Define custom components in `apps/worker/src/game/components/`
2. Create systems in `apps/worker/src/game/systems/`
3. Register in `apps/worker/src/game/room-game.ts`
4. Update Zod schemas in `packages/shared/src/schemas.ts`
5. Test with: `npm run test`

### Phase 5: Deployment

```bash
# Test locally
cd apps/example-game && npm run dev

# Build frontend
npm run build

# Deploy worker backend
cd apps/worker && npm run deploy

# Deploy frontend
cd apps/example-game && npm run deploy

# Or use Wrangler directly
wrangler deploy
```

## Testing Multiplayer Locally

1. Open two browser windows to `http://localhost:5173`
2. Select same game type in both
3. Players connect to same room by default
4. Both windows show multiplayer state sync

## Debugging

### Backend Logs

```bash
cd apps/worker
npx wrangler tail
```

### Frontend DevTools

- Open Chrome DevTools (F12)
- Console shows network messages and game state
- Network tab shows WebSocket traffic to `/ws`

### Admin Dashboard

```bash
cd pages/admin
npm run dev
```

View active rooms at `http://localhost:5174`

---

## Key Files to Understand

| File                                            | Purpose                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `apps/worker/src/game/ecs/world.ts`             | ECS world manager (all entities, systems, components) |
| `apps/worker/src/game/ecs/entity.ts`            | Entity definition and component storage               |
| `apps/worker/src/game/components/`              | Reusable game components (Transform, Health, etc.)    |
| `apps/worker/src/game/systems/movement.ts`      | Server-authoritative movement validation              |
| `apps/worker/src/room-game.ts`                  | ECS-based game room handler                           |
| `apps/worker/src/game-loop.ts`                  | Fixed 20 Hz tick scheduler                            |
| `apps/worker/src/index.ts`                      | WebSocket server and HTTP endpoints                   |
| `apps/example-game/src/main.ts`                 | Game launcher and menu                                |
| `apps/example-game/src/games/moba/moba-game.ts` | Arena Wars implementation                             |
| `apps/example-game/src/games/fps/fps-game.ts`   | CyberArena implementation                             |
| `packages/shared/src/schemas.ts`                | Single source of truth for types                      |

---

## Hot-Loading & Live Ops

Future: Support for runtime system/component swapping:

```typescript
// Update game rules without restarting servers
const newSystemCode = await fetch(cdnUrl).then((r) => r.text());
const newSystem = eval(newSystemCode);
world.replaceSystem("combat", newSystem);
```

This enables game designers to tweak balance, add events, or patch bugs without any downtime.

---

## Anti-Cheat & Security

- **Server Authority**: All game state is computed on the server, never on client
- **Input Validation**: Every move/action is validated against game rules before applying
- **Rate Limiting**: Per-player and per-room limits to prevent flooding
- **Idempotency Keys**: Prevent double-spending on network retries
- **Audit Logging**: All sensitive actions (purchases, rank changes) are logged

---

## Scaling & Performance

- **Durable Objects**: One per active room, handles up to ~1000 concurrent players
- **D1**: Persistent game state (profiles, inventories, leaderboards)
- **Cloudflare Cache**: Static assets and API responses cached at edge
- **Analytics Engine**: Real-time metrics on active rooms, player churn, etc.

---

## Maintenance & Debugging

- **Structured Logging**: Pino logs with context (roomId, playerId, requestId)
- **Error Tracking**: Sentry integration for production error monitoring
- **Health Checks**: `/health` and `/ready` probes for load balancers
- **Metrics**: Prometheus-compatible `/metrics` endpoint
- **SLA Tracking**: `/sla` endpoint for uptime monitoring

---

## Next Steps for Contributors

1. **Review**: Read `README.md` and this file
2. **Understand ECS**: Study `apps/worker/src/game/ecs/` folder
3. **Check Schema**: Review `packages/shared/src/schemas.ts`
4. **Run Example**: `cd apps/example-game && npm run dev`
5. **Play Games**: Open two browser windows and play Arena Wars or CyberArena
6. **Write New Game**: Create new game in `src/games/` and add to menu
7. **Extend Backend**: Add custom components/systems for your game type
8. **Submit PR**: Include game code, schema changes (if any), and README updates

## Questions?

- **Architecture**: See ECS section above
- **How to add new game type**: Extend BaseGame, implement required methods
- **How to generate client code**: Run `npm run generate:types`
- **How to deploy**: See README.md deployment section
