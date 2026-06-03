# PartyGame - The Ultimate Serverless Game Engine

An open-source, enterprise-grade Serverless Game Backend Engine built natively on Cloudflare's Edge Infrastructure (Workers, Durable Objects, D1, R2, and Queues). 

Designed specifically for Indie Developers and Studios, PartyGame bridges the gap between web-native cloud infrastructure and traditional game engines (Unity, Godot, Unreal Engine), providing infinite scalability with **zero server maintenance** and **zero idle costs**.

**📜 Dual Licensed:** Available under [AGPL-3.0](LICENSE) for personal/open-source use, or [Commercial License](LICENSE-COMMERCIAL.md) for commercial products.

---

## 🌟 Enterprise-Grade Features

We didn't just build a WebSocket server. We built a full ecosystem:

- **Stateful Game Rooms (Durable Objects)**: The core `GameRoom` runs on Cloudflare Durable Objects, providing a fixed tick-rate loop, server-authoritative state validation, and persistent WebSockets at the edge.
- **Native Engine SDKs (Unity / Godot / Unreal)**: Fully automated SDK generation using OpenAPI. Define your backend once, and automatically generate strongly-typed `C#` and `GDScript` network clients.
- **Binary Protocol Support**: Bypass JSON overhead. Send `ArrayBuffer` directly from C# or C++ to the backend, triggering `plugin.onBinaryInput()` for zero-latency frame syncing.
- **Over-The-Air (OTA) Hotfixes (R2)**: A built-in patch delivery system. Upload Unity `.assetbundle` or Godot `.pck` files via the Admin Panel, and the backend securely serves them to clients globally using Cloudflare R2 (which has **$0 Egress Fees**).
- **Serverless SQL Leaderboards (D1)**: Highly concurrent, globally distributed leaderboards backed by Cloudflare D1. Handle 100,000 players finishing matches simultaneously without database locks.
- **Asynchronous Match Settlement (Queues)**: Post-match XP and Coin calculations are instantly offloaded to Cloudflare Queues, ensuring the GameRoom Durable Object is immediately freed for the next match.
- **Zero-Trust Player Auth (`jose`)**: Enterprise-grade JWT authentication supporting Google and Apple Login. The backend securely fetches remote JWKS (Public Keys) to verify client-provided tokens without native SDK bloat.
- **Edge Voice Chat (Cloudflare Calls)**: Built-in WebRTC SFU support for low-latency Voice Chat, routed entirely through Cloudflare's massive edge network.

---

## 🏗️ Project Architecture

This repository uses a modern `npm` workspace monorepo structure:

```text
partygame/
  ├── apps/
  │   ├── worker/          # The Core Serverless Engine (Cloudflare Workers)
  │   ├── admin/           # React + Vite Admin Control Plane (Cloudflare Pages)
  │   └── example-game/    # Web-based Reference Game (Babylon.js)
  ├── sdks/
  │   ├── unity/           # Generated & Template C# SDK for Unity
  │   └── godot/           # Generated & Template GDScript SDK for Godot
  └── packages/
      └── shared/          # Shared Zod Schemas and OpenAPI Specs
```

---

## 🚀 Getting Started

### 1. The Core Engine (Worker)
The backend is completely serverless. You only pay when players are online.

```bash
cd apps/worker
npm install

# Run the local Miniflare simulator (simulates D1, DO, R2, Queues)
npm run dev
```
The backend will run on `http://localhost:8787` with:
- `POST /auth/apple` / `POST /auth/google` - Secure Player Login
- `/matchmaker/ws` - Matchmaking Queue
- `/chat/ws` - Global Text Chat
- `/ws?roomId=...` - The Core Game WebSocket

### 2. The Admin Control Plane
A beautiful, separate React dashboard to manage your game empire, styled with Cloudflare Kumo and built with Vite.

```bash
cd apps/admin
npm install
npm run dev
```
From the Admin Panel, you can:
- Apply **Game Presets** (FPS, MOBA, Card Games) to instantly reconfigure backend feature flags.
- **Drag & Drop** game patches to distribute Hotfixes globally.
- Manage Toxic Players and view Server Health.

### 3. Generate Native SDKs
If you update the backend API, simply run:
```bash
npm run generate-sdk
```
This reads the `openapi.yaml` specification and automatically regenerates your C# and GDScript client libraries in the `sdks/` folder.

---

## 🎮 Game Plugin System

The engine is completely decoupled from your specific game logic. To add a new game mode (e.g., Battle Royale), you simply implement the `GamePlugin` interface in the backend:

```typescript
export interface GamePlugin {
  onJoin(session: Session): void;
  onInput(session: Session, inputType: string, data: any): void;
  
  // High-performance binary injection for Unity/Unreal
  onBinaryInput?(session: Session, data: ArrayBuffer): void; 
  
  onTick(sessions: Map<string, Session>): void;
  readonly tickIntervalMs: number;
}
```
Currently included plugins: `FPS`, `MOBA`, `Battle Royale`, `Card Game`, and `Racing`.

---

## ☁️ Deployment

Cloudflare Native CI/CD is fully supported.
To deploy manually:

1. **Provision Infrastructure**:
```bash
# Create the D1 Database
npx wrangler d1 create partygame-db
# Apply the schema
npx wrangler d1 execute partygame-db --file=./schema.sql
# Create the Message Queue
npx wrangler queues create match-queue
```

2. **Deploy the Engine**:
```bash
cd apps/worker
npm run deploy
```

3. **Deploy the Admin Panel**:
```bash
cd apps/admin
npm run build
npx wrangler pages deploy build --project-name partygame-admin
```

---

## 🛠️ Quality Gates

Run these commands from the repository root to ensure your engine is stable:

```bash
npm run generate-sdk
npm run typecheck
npm run format
```

Welcome to the future of Game Development. Zero servers. Infinite scale.
