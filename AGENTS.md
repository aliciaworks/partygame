# AGENTS.md — PartyGame AI Agent Guide

## Overview

PartyGame is a serverless game backend engine running on Cloudflare Workers. It replaces traditional dedicated game servers with edge-native infrastructure (Durable Objects, R2, D1, Queues, AI, Calls).

This document is the knowledge base for AI coding agents working on this codebase.

## Project Structure

```
partygame/
├── apps/
│   ├── worker/            # Core engine: Hono router + Durable Objects + modules
│   ├── admin/             # React admin SPA (Vite, Kumo UI, i18n)
│   └── landing/           # Marketing page (Astro → Cloudflare Pages via GH Actions)
├── engines/
│   ├── unity/             # C# SDK for Unity
│   ├── godot/             # GDScript addon for Godot
│   └── unreal/            # C++ plugin for Unreal Engine
├── packages/
│   ├── shared/            # Zod schemas, type generation, shared types
│   └── cli/               # AI-agent-friendly CLI (`npx partygame`)
├── scripts/               # Build helpers (generate-admin-index.js)
├── openapi.yaml           # Full OpenAPI 3.0.3 spec — source of truth for all endpoints
└── .github/workflows/     # CI (ci.yml) + landing deploy (deploy-landing.yml)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (`wrangler`) |
| Router | Hono |
| State | Durable Objects (GameRoom, MatchmakerRoom, ChatRoom, GuildRoom) |
| Storage | R2 (`PLATFORM_BUCKET`) |
| SQL | D1 (`DB`) |
| Async | Queues (`MATCH_QUEUE`) |
| Real-time | WebSockets (Hono `upgradeWebSocket`) |
| Voice | Cloudflare Calls (WebRTC SFU) |
| AI | Workers AI (`AI` binding) |
| Auth | `jose` JWT (Google, Apple, player tokens) |
| Admin UI | React 19 + Vite + Kumo UI (`@cloudflare/kumo`) + Tailwind v4 |
| i18n | `react-i18next` (en, zh, ja, ko) |
| Landing | Astro + Tailwind CDN |
| SDK gen | OpenAPI Generator (`openapitools.json`) |

## Worker Architecture

### Entry Point (`apps/worker/src/index.ts`)

The Hono app registers:
1. **Global middleware** — rate limiting, platform state cache, client version check, admin auth, maintenance mode, deprecation headers
2. **Modules** — loaded via `mountModules(app)` from `modules/loader.ts`
3. **Core routes** — `/`, `/health`, `/ws`, `/openapi.yaml`, `/.well-known/agent-config.json`
4. **Admin API routes** — platform state, modules, players, assets, hotfixes
5. **Admin SPA catch-all** — serves `index.html` for `/admin/*` client-side routes

### Module System (`apps/worker/src/modules/`)

Each module exports a `WorkerModule` with `manifest` and `init(app)`:

| Module | Routes | Description |
|--------|--------|-------------|
| `player_auth` | `/auth/*` | Login, JWT, Google/Apple OAuth |
| `player_progress` | — | XP/level tracking |
| `player_management` | `/admin/players/*` | Admin player CRUD, ban/unban, audit |
| `player_profile` | `/profile/*` | Player profile read/write |
| `hotfix` | `/hotfix/*` | Patch upload, promote, rollback |
| `matchmaking` | `/matchmaker/*` | Join queue, status, WebSocket |
| `friends` | — | Friend lists |
| `chat` | `/chat/*` | Text chat WebSocket, AI moderation |
| `leaderboard` | `/leaderboard/*` | Scores, rankings |
| `voice` | — | Cloudflare Calls WebRTC |
| `economy` | — | In-app purchases |
| `seasons` | — | Seasonal content |
| `guilds` | — | Guild system |
| `assets` | `/admin/assets/*`, `/api/assets/*` | Watermark, A/B testing, forensic |

### Feature Flag System

Features are stored in `admin/platform-state.json` in R2 and served via headers (`X-Available-Features`). Modules can gate routes with `isFeatureEnabled()`.

11 feature flags: `voiceChat`, `textChat`, `gameUpdates`, `matchmaking`, `leaderboard`, `friends`, `playerProfile`, `seasons`, `replays`, `guilds`, `watermark`

Toggle via: `PATCH /admin/platform/features` or `npx partygame feature <name> <on|off>`

### Platform State (`apps/worker/src/platform-state.ts`)

```typescript
type PlatformState = {
  features: PlatformFeatures;       // boolean flags
  currencies: Record<string, CurrencyDef>;
  seasons: { currentSeasonId, endsAt };
  apiVersion: string;               // ISO date YYYY-MM-DD
  minClientVersion?: string;        // SemVer
  deprecations: Deprecation[];
  maintenance?: MaintenanceWindow;
  serverTiers: ServerTierDef[];     // Environments (main, internal-testing, etc.)
  revision: number;
  updatedAt: string;
};
```

Cached in memory for 15s. Optimistic concurrency via `revision` + `if-match` header.

### R2 Storage Layout

```
PLATFORM_BUCKET/
├── admin/platform-state.json      # { features, serverTiers, maintenance, ... }
├── game-updates/                   # Hotfix patches
│   ├── index.json
│   ├── latest
│   └── {version}/
│       ├── manifest.json
│       └── patch.zip
├── players/                        # Player data
│   ├── {playerId}/
│   │   ├── account.json
│   │   ├── ban.json
│   │   └── progress.json
│   └── _audit/                     # Audit logs
├── leaderboards/                   # Leaderboard snapshots
└── game-assets/                    # Watermarked assets
    ├── index.json
    └── {assetId}/
        ├── manifest.json
        ├── v0.bin                  # Watermarked variants
        └── v1.bin
```

## Admin Panel (`apps/admin/`)

- **Framework**: React 19 + Vite + React Router 7
- **UI Library**: Kumo UI (`@cloudflare/kumo`) — Cloudflare's design system
- **Styling**: Tailwind v4 with Kumo semantic tokens (`bg-kumo-base`, `text-kumo-default`, etc.)
- **Icons**: `@phosphor-icons/react` (Kumo standard)
- **i18n**: 4 languages (en, zh, ja, ko)

### Kumo UI Rules (CRITICAL)
- **ONLY semantic tokens**: `bg-kumo-base`, `text-kumo-default`, `border-kumo-line`, `bg-kumo-elevated`, `bg-kumo-recessed`, `text-kumo-subtle`
- **NEVER raw Tailwind colors**: `bg-blue-500`, `text-gray-900`
- **NEVER `dark:` prefix**: dark mode is automatic via `light-dark()` CSS
- Surface hierarchy: `bg-kumo-base` → `bg-kumo-elevated` → `bg-kumo-recessed`
- Use `<data-mode="light"|"dark">` on root element for theme

### Pages
| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Feature flag overview with status badges |
| `/modules` | Modules | Toggle feature flags on/off |
| `/assets` | Assets | Upload assets with watermark, A/B/C testing, forensic extraction |
| `/operations` | Operations | Hotfix upload, promote, rollback |
| `/players` | Players | Player list, ban/unban |
| `/settings` | Settings | Maintenance mode + server tiers management |

### Deployment
- `vite.config.ts` sets `base: '/admin/'`
- Worker's `[assets]` in `wrangler.toml` serves `admin-dist/` directory
- `npm run build-admin` (from `apps/worker`) builds admin + copies to `admin-dist/admin/`

## Watermark & A/B Testing System

### Architecture
```
Admin Browser                    Worker (Server)
─────────────                    ───────────────
1. Upload file                   
2. Web Crypto HMAC-SHA256        
   generates N variants          
   each with 38-byte watermark   
3. PUT each variant              
                                 4. Store to R2
                                 5. Serve via HMAC(userId, assetId) % N
```

### Watermark Block (38 bytes)
```
Offset  Size  Field
0       4     Magic "PGWM" (0x50 0x47 0x57 0x4D)
4       2     Variant Index (uint16 LE)
6       32    HMAC-SHA256 payload
```

Embedded at end of file. Non-destructive. Extracted via forensic endpoint.

### Key Files
- `apps/admin/src/lib/watermark.ts` — Browser-side generation + local extraction
- `apps/worker/src/modules/assets/watermark-engine.ts` — Server-side selection + extraction
- `apps/worker/src/modules/assets/index.ts` — API endpoints

## AI-Agent-Friendly Configuration

Three ways for AI agents to interact:

### 1. Discovery Endpoints (no auth)
```
GET /.well-known/agent-config.json   # Manifest with all endpoints, features, protocols
GET /openapi.yaml                    # Full OpenAPI 3.0.3 spec
```

### 2. CLI Tool
```bash
PARTYGAME_URL=https://your-worker.workers.dev \
PARTYGAME_TOKEN=<admin-secret> \
npx partygame <command>
```

See `packages/cli/bin/partygame.js` for all commands.

### 3. Direct REST API
```bash
curl -H "Authorization: Bearer <ADMIN_SECRET>" \
  https://your-worker.workers.dev/admin/platform
```

## API Authentication

| Type | Header | Used By |
|------|--------|---------|
| Admin | `Authorization: Bearer <ADMIN_SECRET>` or `X-Admin-Token` | Admin panel, CLI, AI agents |
| Player | `Authorization: Bearer <JWT>` | Game clients |
| Public | None | Health, openapi, agent-config |

Admin routes: middleware checks `c.req.path.startsWith("/admin")` and validates against `c.env.ADMIN_SECRET`.

## Deployment

### Worker + Admin (single deploy)
```bash
cd apps/worker
npm run build-admin   # Build admin SPA → admin-dist/
npm run deploy        # wrangler deploy (Worker + static assets)
```

### Landing Page
Auto-deploys to Cloudflare Pages via `.github/workflows/deploy-landing.yml` on push to `main` when `apps/landing/**` changes.

Secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Commands Reference

```bash
# Root
npm run typecheck         # TypeScript check
npm run lint              # ESLint
npm run test              # Vitest
npm run format            # Prettier
npm run generate:types    # Generate shared types
npm run generate-sdk      # OpenAPI → C# SDK

# Worker
npm run dev -w @partygame/worker
npm run deploy -w @partygame/worker
npm run build-admin -w @partygame/worker

# Admin
npm run dev -w @partygame/admin
npm run build -w @partygame/admin

# Landing
npm run dev -w @partygame/landing
npm run build -w @partygame/landing
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Use raw Tailwind colors in admin (`bg-gray-900`) | Use Kumo semantic tokens (`bg-kumo-base`) |
| Use `dark:` prefix | Kumo handles dark mode automatically |
| Add `lucide-react` icons | Use `@phosphor-icons/react` (Kumo standard) |
| Create custom UI components | Import from `@cloudflare/kumo` or `./ui` (re-exports) |
| Store secrets in code | Use `wrangler secret put` or `.dev.vars` |
| Hardcode worker URL in admin | Read from `localStorage` (portal.ts `BACKEND_STORAGE_KEY`) |
