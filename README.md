# EdgePulse (Serverless Game Backend Framework)

An open-source, out-of-the-box Serverless Game Backend Framework built on Cloudflare Workers, Durable Objects, and D1.

## Features

* **Authoritative GameRoom (`@edgepulse/core`)**: Built on `partyserver` (Cloudflare Durable Objects). Features a fixed tick-rate loop and server-authoritative anti-cheat movement validation out of the box.
* **Game Identity (`@edgepulse/auth`)**: Powered by `better-auth`. Seamlessly bypasses cookie dependency, providing explicit stateless Session Token extraction for native game clients (Unity, Godot, etc.).
* **ACID-Compliant Transactions**: Built with Drizzle ORM and Cloudflare D1. Features strict transactional logic for inventory loops, completely preventing race conditions and item duplication under heavy load.

## Project Structure

This repository uses a `pnpm` workspace monorepo structure:
- `packages/core`: The framework server engine (GameRoom, Networking, Database Logic).
- `packages/auth`: Better Auth integration and custom endpoints.
- `packages/client-ts`: Shared TypeScript SDK for Web/Cocos/Godot JS.
- `fixtures/example-game`: An example Cloudflare Worker project tying the framework components together.

## Getting Started

1. Install the dependencies via pnpm:
   ```bash
   pnpm install
   ```

2. Configure your database bindings in `fixtures/example-game/wrangler.toml`.

3. Run the development server for the example game:
   ```bash
   cd fixtures/example-game
   npx wrangler dev
   ```
