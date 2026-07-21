# PartyGame — Serverless Game Engine

An open-source, serverless game backend engine built natively on Cloudflare's edge infrastructure (Workers, Durable Objects, D1, R2, Queues, AI, Calls).

Designed for indie developers and studios. Zero server maintenance. Zero idle cost. Pay only when players are online.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aliciaworks/partygame)
[![Live Demo](https://img.shields.io/badge/Demo-Admin%20Panel-6366f1?style=for-the-badge)](https://partygame-example-backend.aliciaworks.workers.dev/admin/)

---

## Features

| Feature | Implementation |
|---------|---------------|
| **Stateful Game Rooms** | Durable Objects with fixed tick-rate loop, server-authoritative validation, persistent WebSockets |
| **Matchmaking** | Durable Objects matchmaking queue, real-time ELO updates |
| **Voice Chat** | WebRTC SFU via Cloudflare Calls — low-latency, edge-routed |
| **Text Chat** | WebSocket chat rooms with AI-powered moderation (Workers AI) |
| **Leaderboards** | D1 SQL + Queue async batch writes — globally distributed |
| **Player Profiles & Friends** | R2-stored JSON profiles, friend lists |
| **OTA Hotfixes** | R2-stored patches, upload via Admin, served globally with $0 egress |
| **Hidden Watermark** | Browser-side HMAC watermarking on asset upload, forensic leak tracing |
| **A/B Testing** | Deterministic asset variant distribution by player ID |
| **Server Tiers** | Manage environments (internal-testing, main, public-testing) from admin panel |
| **Engine SDKs** | Unity (C#), Godot (GDScript), Unreal (C++) — auto-generated from OpenAPI |
| **AI-Agent-Friendly** | OpenAPI spec, `.well-known/agent-config.json`, CLI tool |
| **Admin Panel** | React SPA with Kumo UI, served from the Worker (single deploy) |
| **Admin Auth** | D1-backed email/password login + TOTP 2FA + Passkey — no env secrets needed |

---

## Project Structure

```
partygame/
├── apps/
│   ├── worker/         # Core serverless engine (Cloudflare Worker + Hono)
│   └── admin/          # React admin SPA (Vite, Kumo UI, i18n)
├── engines/
│   ├── unity/          # C# SDK for Unity
│   ├── godot/          # GDScript SDK for Godot
│   └── unreal/         # C++ SDK for Unreal Engine
├── packages/
│   ├── shared/         # Zod schemas, type generation, OpenAPI types
│   └── cli/            # AI-agent-friendly CLI (`npx partygame`)
├── test/
│   └── benchmarks/     # Nakama vs PartyGame benchmarks
├── openapi.yaml        # Full OpenAPI 3.0.3 spec
└── scripts/            # Build helpers
```

---

## Getting Started

### Prerequisites
- Node.js 22+
- Cloudflare account (free tier works)

### 1. Install & Run Locally

```bash
npm install            # Install all workspaces
npm run dev -w @partygame/worker   # Worker at http://localhost:8787
npm run dev -w @partygame/admin    # Admin dev server (optional)
```

### 2. Set Up D1 Database

```bash
cd apps/worker
npx wrangler d1 migrations apply partygame-db --remote
```

### 3. Deploy

```bash
cd apps/worker
npm run build-admin    # Builds admin SPA → admin-dist/
npx wrangler deploy     # Deploys Worker + admin + assets
```

The admin panel is served from the Worker at `/admin/` — single deploy, no separate Pages project needed.

---

## API Overview

| Path | Auth | Description |
|------|------|-------------|
| `GET /` | None | Worker info + module manifest |
| `GET /health` | None | Health check |
| `GET /openapi.yaml` | None | Full OpenAPI 3.0.3 spec |
| `GET /.well-known/agent-config.json` | None | AI-agent discovery manifest |
| `POST /auth/login` | None | Player login |
| `POST /auth/google` | None | Google OAuth login |
| `POST /auth/apple` | None | Apple OAuth login |
| `GET /api/platform` | None | Public platform state |
| `GET /api/assets/:id` | None | Asset serving (deterministic variant) |
| `GET /ws?roomId=` | Player | Game WebSocket |
| `GET /matchmaker/ws` | Player | Matchmaking WebSocket |
| `GET /leaderboard/:id` | Player | Get leaderboard |
| `POST /leaderboard/:id/submit` | Player | Submit score |
| `GET /profile/:id` | Player | Get player profile |
| `GET /hotfix/latest` | Player | Get latest hotfix |

### Admin Auth (D1-backed, no `ADMIN_SECRET` needed)

| Path | Description |
|------|-------------|
| `GET /admin/auth/state` | Check if setup is needed |
| `GET /admin/auth/methods` | Available auth methods |
| `POST /admin/auth/bootstrap` | First-time admin registration |
| `POST /admin/auth/sign-in` | Sign in with email + password |
| `POST /admin/auth/invite` | Invite new admin (requires existing admin) |
| `POST /admin/auth/accept` | Accept invite + register |
| `POST /admin/auth/2fa/enable` | Enable TOTP 2FA |
| `POST /admin/auth/passkey/register` | Register passkey |
| `GET /admin/auth/passkey/list` | List registered passkeys |
| `PATCH /admin/auth/profile` | Update email or password |

### Admin API

| Path | Description |
|------|-------------|
| `GET /admin/platform` | Full platform state |
| `PATCH /admin/platform` | Update platform state (maintenance, tiers) |
| `PATCH /admin/platform/features` | Toggle feature flags |
| `GET /admin/modules` | List modules |
| `GET /admin/players` | List players |
| `POST /admin/players/:id/ban` | Ban player |
| `DELETE /admin/players/:id/ban` | Unban player |
| `GET /admin/assets` | List assets |
| `POST /admin/assets` | Create asset |
| `DELETE /admin/assets/:id` | Delete asset |
| `PUT /admin/assets/:id/variant/:idx/upload` | Upload variant |
| `POST /admin/assets/forensic/watermark` | Forensic extraction |
| `POST /hotfix/upload` | Upload hotfix |
| `GET /hotfix/list` | List hotfixes |
| `POST /hotfix/promote/:version` | Promote hotfix |
| `POST /hotfix/rollback/:version` | Rollback hotfix |
| `GET /admin/*` | Admin SPA (static files) |

Full spec: `openapi.yaml` or `GET /openapi.yaml`.

---

## Admin Auth

No `ADMIN_SECRET` environment variable anymore. First visitor registers via bootstrap, after that only invited users can join.

```bash
# First time
curl -X POST https://your-worker.workers.dev/admin/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'

# Sign in
curl -X POST https://your-worker.workers.dev/admin/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
# → {"token":"...","user":{"id":"...","email":"admin@example.com",...}}

# Use token for admin API calls
curl -H "Authorization: Bearer <token>" \
  https://your-worker.workers.dev/admin/platform
```

## Feature Flags

Toggle via Admin panel, API, or CLI:

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
| `watermark` | false | Hidden watermark on assets |
| `abTesting` | false | A/B testing with asset variants |

## AI Agent Configuration

AI agents can interact via:

### REST + OpenAPI
```bash
curl https://your-worker.workers.dev/openapi.yaml
curl https://your-worker.workers.dev/.well-known/agent-config.json
```

### Direct API
```bash
# Sign in to get token
TOKEN=$(curl -s -X POST https://your-worker.workers.dev/admin/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' | jq -r .token)

# Use token
curl -H "Authorization: Bearer $TOKEN" \
  https://your-worker.workers.dev/admin/platform
```

---

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
| Auth | Web Crypto API (zero deps, no `nodejs_compat`) |
| Admin UI | React 19 + Vite + Kumo UI + Tailwind v4 |
| i18n | `react-i18next` (en, zh, ja, ko) |

---

## Quality Gates

```bash
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run test         # Vitest
npm run format       # Prettier
```

---

## Benchmark

Real benchmark comparing PartyGame (Cloudflare Workers) vs Nakama (Docker + CockroachDB):

```bash
podman compose -f test/benchmarks/nakama/docker-compose.yml up -d
PG_URL=https://your-worker.workers.dev node test/benchmarks/run.mjs
```

Results at 308ms network RTT:
- PartyGame auth throughput: ~170 req/s (50 concurrent connections)
- PartyGame cold start: <5ms (v8 isolate)
- Nakama cold start: ~8s (Docker + CockroachDB)
- 1K CCU/month: PartyGame ~$10 vs Nakama ~$3,550

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
