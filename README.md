# PartyGame — Serverless Game Engine

An open-source, serverless game backend engine built natively on Cloudflare's edge infrastructure (Workers, Durable Objects, D1, R2, Queues, AI, Calls).

Designed for indie developers and studios. Zero server maintenance. Zero idle cost. Pay only when players are online.

**License:** [AGPL-3.0](LICENSE) for open-source / [Commercial](LICENSE-COMMERCIAL.md) for commercial products.

---

## Features

| Feature | Implementation |
|---------|---------------|
| **Stateful Game Rooms** | Durable Objects with fixed tick-rate loop, server-authoritative validation, persistent WebSockets |
| **Matchmaking** | Durable Objects matchmaking queue with configurable game types (FPS, MOBA, etc.) |
| **Voice Chat** | WebRTC SFU via Cloudflare Calls — low-latency, edge-routed |
| **Text Chat** | WebSocket chat rooms with AI-powered moderation (Workers AI) |
| **Leaderboards** | D1 SQL — globally distributed, highly concurrent |
| **Player Profiles & Friends** | R2-stored JSON profiles, friend lists |
| **OTA Hotfixes** | R2-stored patches, upload via Admin, served globally with $0 egress |
| **Hidden Watermark & A/B Testing** | Browser-side HMAC watermarking on asset upload, deterministic variant distribution for leak tracing |
| **Server Tiers** | Manage environments (internal-testing, main, public-testing) from admin panel |
| **Engine SDKs** | Unity (C#), Godot (GDScript), Unreal (C++) — auto-generated from OpenAPI |
| **AI-Agent-Friendly Config** | OpenAPI spec endpoint, `.well-known/agent-config.json`, CLI tool (`npx partygame`) |
| **Admin Panel** | React SPA with Kumo UI, served from the same Worker |

---

## Project Structure

```
partygame/
├── apps/
│   ├── worker/         # Core serverless engine (Cloudflare Worker + Hono)
│   ├── admin/          # React admin SPA (Vite, Kumo UI)
│   └── landing/        # Marketing landing page (Astro → Cloudflare Pages)
├── engines/
│   ├── unity/          # C# SDK for Unity
│   ├── godot/          # GDScript SDK for Godot
│   └── unreal/         # C++ SDK for Unreal Engine
├── packages/
│   ├── shared/         # Zod schemas, type generation, OpenAPI types
│   └── cli/            # AI-agent-friendly CLI (`npx partygame`)
├── sdks/               # Legacy SDK output (Unity .unitypackage)
├── openapi.yaml        # Full OpenAPI 3.0.3 spec (35+ endpoints)
└── scripts/            # Build helpers
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Cloudflare account (free tier works)

### 1. Core Engine (Worker)

```bash
cd apps/worker
npm install
npm run dev          # Miniflare local simulator (D1, DO, R2, Queues)
```

Worker runs at `http://localhost:8787`.

### 2. Admin Panel

```bash
cd apps/admin
npm install
npm run dev          # Vite dev server
```

The admin panel is also served from the Worker at `/admin/` in production (single deploy).

### 3. Deploy Everything

```bash
cd apps/worker
npm run build-admin  # Builds admin SPA → admin-dist/
npm run deploy       # Deploys Worker + admin static assets
```

### 4. Landing Page

```bash
cd apps/landing
npm install
npm run dev          # Astro dev server
```

Deploys to Cloudflare Pages via GitHub Actions on push to `main`.

---

## API Overview

| Path | Auth | Description |
|------|------|-------------|
| `GET /` | None | Worker info + module manifest |
| `GET /health` | None | Health check |
| `GET /openapi.yaml` | None | Full OpenAPI 3.0.3 spec (35+ endpoints) |
| `GET /.well-known/agent-config.json` | None | AI-agent discovery manifest |
| `POST /auth/login` | None | Player login |
| `POST /auth/google` | None | Google OAuth login |
| `POST /auth/apple` | None | Apple OAuth login |
| `GET /api/platform` | None | Public platform state |
| `GET /api/assets/:id` | None | Asset serving (deterministic variant) |
| `GET /ws?roomId=` | Player | Game WebSocket |
| `GET /matchmaker/ws` | Player | Matchmaking WebSocket |
| `POST /matchmaking/join` | Player | Join match queue |
| `GET /leaderboard/:id` | Player | Get leaderboard |
| `POST /leaderboard/:id/submit` | Player | Submit score |
| `GET /profile/:id` | Player | Get player profile |
| `GET /hotfix/latest` | Player | Get latest hotfix |
| `GET /admin/platform` | Admin | Full platform state |
| `PATCH /admin/platform` | Admin | Update platform state |
| `PATCH /admin/platform/features` | Admin | Toggle feature flags |
| `GET /admin/modules` | Admin | List modules |
| `GET /admin/players` | Admin | List players |
| `POST /admin/players/:id/ban` | Admin | Ban player |
| `DELETE /admin/players/:id/ban` | Admin | Unban player |
| `GET /admin/assets` | Admin | List assets |
| `POST /admin/assets` | Admin | Create asset |
| `DELETE /admin/assets/:id` | Admin | Delete asset |
| `PUT /admin/assets/:id/variant/:idx/upload` | Admin | Upload variant |
| `POST /admin/assets/forensic/watermark` | Admin | Forensic extraction |
| `POST /hotfix/upload` | Admin | Upload hotfix |
| `GET /hotfix/list` | Admin | List hotfixes |
| `POST /hotfix/promote/:version` | Admin | Promote hotfix |
| `POST /hotfix/rollback/:version` | Admin | Rollback hotfix |
| `GET /admin/*` | None | Admin SPA (static) |

Full spec: `openapi.yaml` or `GET /openapi.yaml`.

---

## AI Agent Configuration

AI agents (Claude, Cursor, Copilot) can configure PartyGame three ways:

### 1. REST API + OpenAPI
```bash
curl https://your-worker.workers.dev/openapi.yaml    # Full spec
curl https://your-worker.workers.dev/.well-known/agent-config.json  # Manifest
```

### 2. CLI Tool
```bash
PARTYGAME_URL=https://your-worker.workers.dev \
PARTYGAME_TOKEN=<admin-secret> \
npx partygame status

npx partygame feature watermark on
npx partygame assets list
npx partygame players ban <playerId>
```

### 3. Direct API Calls
```bash
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"voiceChat": false}' \
  https://your-worker.workers.dev/admin/platform/features
```

---

## Feature Flags

All platform features can be toggled via API, CLI, or Admin panel:

| Flag | Default | Description |
|------|---------|-------------|
| `voiceChat` | true | WebRTC voice via Cloudflare Calls |
| `textChat` | true | WebSocket text chat |
| `gameUpdates` | true | OTA hotfix delivery |
| `matchmaking` | true | Auto player matching |
| `leaderboard` | true | Global rankings |
| `friends` | true | Friend system |
| `playerProfile` | true | Player profiles |
| `seasons` | true | Seasonal content |
| `replays` | true | Match replays |
| `guilds` | true | Guild system |
| `watermark` | false | Hidden watermark & A/B testing |

---

## Quality Gates

```bash
npm run typecheck    # TypeScript check all packages
npm run lint         # ESLint
npm run test         # Vitest
npm run format       # Prettier check
```

---

## Architecture

```
Clients (Unity / Godot / Unreal / Web)
        │
        ▼
┌───────────────────────────────┐
│     Cloudflare Edge Network   │
│  ┌─────────────────────────┐  │
│  │   Worker (Hono Router)  │  │
│  │  ┌────────────────────┐ │  │
│  │  │ GameRoom (DO)      │ │  │
│  │  │ MatchmakerRoom (DO)│ │  │
│  │  │ ChatRoom (DO)      │ │  │
│  │  │ GuildRoom (DO)     │ │  │
│  │  └────────────────────┘ │  │
│  │  R2 ─── D1 ─── Queues  │  │
│  │  AI ─── Calls ─── Rate │  │
│  │  /admin/ (SPA static)  │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

Zero servers. Infinite scale. Built on Cloudflare.
