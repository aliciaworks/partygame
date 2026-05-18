# PartyGame (Serverless Game Backend Framework)

An open-source, out-of-the-box Serverless Game Backend Framework built natively for Cloudflare Workers, Durable Objects, and D1. It is designed to bridge the gap between web-native infrastructure and traditional game engines (Unity, Godot, and Unreal Engine).

## Features

- **Authoritative GameRoom (`@partygame/core`)**: Built on `partyserver` (Cloudflare Durable Objects). Features a fixed tick-rate loop, server-authoritative anti-cheat movement validation, and an automatic Ping-Pong Keep-Alive mechanism to prevent stale connections.
- **ACID-Compliant Transactions (`@partygame/core/db`)**: Built with Drizzle ORM and Cloudflare D1. Features strict transactional logic for game inventory loops. Includes built-in **Idempotency Key** validation to prevent double-spending on network retries, and **Soft Deletes** for safe inventory management.
- **Game Identity (`@partygame/auth`)**: Powered by `better-auth`. Seamlessly bypasses cookie dependency, providing explicit stateless Session Token extraction for native game engines. Includes a dedicated Refresh Token bridge for persistent login states without relying on web cookies.
- **Cross-Engine Type Generation (`@partygame/shared`)**: Single source of truth. Define your networking models and database schemas in TypeScript (Zod), and automatically generate `C#` for Unity, `GDScript` for Godot, and `C++ Structs` for Unreal Engine simultaneously.
- **Security Middleware (`@partygame/core/middleware`)**: Built-in API Rate Limiting for Hono routes to prevent abuse of the Serverless backend.

## Project Structure

This repository uses a native `npm` workspace monorepo structure:

- `packages/core`: The framework server engine (GameRoom, Networking, Database Logic, Middleware).
- `packages/auth`: Better Auth integration and token bypass endpoints.
- `packages/shared`: Shared Zod schemas and the cross-engine code generation scripts.
- `fixtures/example-game`: An example Cloudflare Worker project tying the framework components together.
- `clients/`: Auto-generated client SDKs and native structural types for Unity, Godot, and Unreal Engine.

## Getting Started

1. Install the dependencies via native npm:

   ```bash
   npm install
   ```

2. Generate client types for your game engines:

   ```bash
   npm run generate:types --workspace=@partygame/shared
   ```

3. Configure your database bindings in `fixtures/example-game/wrangler.toml`.

4. Run the development server for the example game:

   ```bash
   cd fixtures/example-game
   npx wrangler dev
   ```

5. Run the admin control plane separately:
   ```bash
   cd pages/admin
   npm run dev
   ```

## Deployment

### Worker backend

The worker entrypoint is the example game in [fixtures/example-game](fixtures/example-game). Deploy it with Wrangler from that directory:

```bash
cd fixtures/example-game
npm run deploy
```

Before deploying, make sure these values are set in `wrangler.toml`:

- `database_id` for your D1 database
- any Durable Object migration state you need for the current version

If you changed the Durable Object class name or schema, create and apply a new migration before deploying.

### Pages admin app

The admin UI lives in [pages/admin](pages/admin) and deploys separately as a Cloudflare Pages site:

```bash
cd pages/admin
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

The management interface now lives in [pages/admin](pages/admin). It is a separate SvelteKit workspace that is built for Pages-style deployment rather than the Worker runtime, so the control plane stays isolated from the game backend.

## Native Auth

The native login route now verifies real Google or Apple ID tokens. Set the corresponding client ID bindings in your Worker environment before using the `/api/auth/login/native` endpoint:

- `GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID`

The refresh endpoint is still intentionally conservative and returns `501` until a session lookup flow is wired in.

## Notes On Abuse Resistance

`@partygame/core` now includes stricter message parsing, movement validation, and purchase request validation. The current rate limiter is still in-memory and should be replaced with a distributed store for production deployments that span multiple isolates or regions.
