#!/usr/bin/env node
/**
 * PartyGame CLI — AI-agent-friendly platform configuration tool.
 *
 * Usage:
 *   npx partygame status
 *   npx partygame feature voiceChat on
 *   npx partygame players list
 *   npx partygame players ban <playerId>
 *   npx partygame hotfix list
 *   npx partygame assets list
 *   npx partygame assets create <name> [--watermark] [--variants=N]
 *
 * Config via env vars:
 *   PARTYGAME_URL=https://your-worker.workers.dev
 *   PARTYGAME_TOKEN=<admin-secret>
 *
 * Output: JSON to stdout (AI-agent parsable), errors to stderr.
 */

const BASE_URL = process.env.PARTYGAME_URL || "http://localhost:8787";
const TOKEN = process.env.PARTYGAME_TOKEN || "";

async function api(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    process.stderr.write(`Error ${res.status}: ${text}\n`);
    process.exit(1);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

const commands: Record<string, (args: string[]) => Promise<void>> = {
  async status() {
    const state = await api("GET", "/admin/platform");
    console.log(JSON.stringify(state, null, 2));
  },

  async config() {
    const config = await api("GET", "/.well-known/agent-config.json");
    console.log(JSON.stringify(config, null, 2));
  },

  async openapi() {
    console.log(`${BASE_URL}/openapi.yaml`);
  },

  async feature(args: string[]) {
    const [name, value] = args;
    if (!name || !["on", "off", "true", "false"].includes(value)) {
      process.stderr.write("Usage: partygame feature <name> <on|off>\n");
      process.exit(1);
    }
    const result = await api("PATCH", "/admin/platform/features", { [name]: value === "on" || value === "true" });
    console.log(JSON.stringify(result, null, 2));
  },

  async players(args: string[]) {
    const sub = args[0];
    if (sub === "list") {
      const data = await api("GET", "/admin/players");
      console.log(JSON.stringify(data, null, 2));
    } else if (sub === "ban" && args[1]) {
      const result = await api("POST", `/admin/players/${args[1]}/ban`, { reason: args.slice(2).join(" ") || "Banned via CLI" });
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === "unban" && args[1]) {
      const result = await api("DELETE", `/admin/players/${args[1]}/ban`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      process.stderr.write("Usage: partygame players <list|ban|unban> [playerId]\n");
      process.exit(1);
    }
  },

  async hotfix(args: string[]) {
    const sub = args[0];
    if (sub === "list") {
      const data = await api("GET", "/hotfix/list");
      console.log(JSON.stringify(data, null, 2));
    } else if (sub === "promote" && args[1]) {
      const result = await api("POST", `/hotfix/promote/${args[1]}`);
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === "rollback" && args[1]) {
      const result = await api("POST", `/hotfix/rollback/${args[1]}`);
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === "delete" && args[1]) {
      const result = await api("DELETE", `/hotfix/${args[1]}`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      process.stderr.write("Usage: partygame hotfix <list|promote|rollback|delete> [version]\n");
      process.exit(1);
    }
  },

  async assets(args: string[]) {
    const sub = args[0];
    if (sub === "list") {
      const data = await api("GET", "/admin/assets");
      console.log(JSON.stringify(data, null, 2));
    } else if (sub === "create" && args[1]) {
      const name = args[1];
      const watermark = args.includes("--watermark");
      const variantsIdx = args.findIndex((a) => a.startsWith("--variants="));
      const variants = variantsIdx !== -1 ? parseInt(args[variantsIdx].split("=")[1]) || 4 : 4;
      const result = await api("POST", "/admin/assets", { name, watermarkEnabled: watermark, variantCount: variants });
      console.log(JSON.stringify(result, null, 2));
    } else if (sub === "delete" && args[1]) {
      const result = await api("DELETE", `/admin/assets/${args[1]}`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      process.stderr.write("Usage: partygame assets <list|create|delete> [name|id] [--watermark] [--variants=N]\n");
      process.exit(1);
    }
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
  console.log(`PartyGame CLI — AI-agent-friendly platform config

Usage: npx partygame <command> [args]

Commands:
  status                      Get full platform state (JSON)
  config                      Get agent-config manifest
  openapi                     Print OpenAPI spec URL
  feature <name> <on|off>     Toggle a feature flag
  players list                List all players
  players ban <playerId>      Ban a player
  players unban <playerId>    Unban a player
  hotfix list                 List hotfixes
  hotfix promote <version>    Promote a hotfix
  hotfix rollback <version>   Rollback to a version
  hotfix delete <version>     Delete a hotfix
  assets list                 List all assets
  assets create <name>        Create asset [--watermark] [--variants=N]
  assets delete <id>          Delete an asset

Environment:
  PARTYGAME_URL   Worker URL (default: http://localhost:8787)
  PARTYGAME_TOKEN Admin secret token

Output: JSON to stdout. Errors to stderr.
`);
  process.exit(0);
}

const handler = commands[cmd];
if (!handler) {
  process.stderr.write(`Unknown command: ${cmd}\nRun 'partygame help' for usage.\n`);
  process.exit(1);
}

handler(args).catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
