#!/usr/bin/env node
/**
 * PartyGame CLI — AI-agent-friendly platform configuration.
 * Usage: npx partygame <command>
 * Config: PARTYGAME_URL + PARTYGAME_TOKEN env vars
 * Output: JSON to stdout, errors to stderr.
 */

const BASE_URL = process.env.PARTYGAME_URL || "http://localhost:8787";
const TOKEN = process.env.PARTYGAME_TOKEN || "";

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) { process.stderr.write(`Error ${res.status}: ${text}\n`); process.exit(1); }
  try { return JSON.parse(text); } catch { return text; }
}

const commands = {
  async status() { console.log(JSON.stringify(await api("GET", "/admin/platform"), null, 2)); },
  async config() { console.log(JSON.stringify(await api("GET", "/.well-known/agent-config.json"), null, 2)); },
  async openapi() { console.log(`${BASE_URL}/openapi.yaml`); },
  async feature(args) {
    const [name, value] = args;
    if (!name || !["on","off","true","false"].includes(value)) { process.stderr.write("Usage: partygame feature <name> <on|off>\n"); process.exit(1); }
    console.log(JSON.stringify(await api("PATCH", "/admin/platform/features", { [name]: value === "on" || value === "true" }), null, 2));
  },
  async players(args) {
    const sub = args[0];
    if (sub === "list") console.log(JSON.stringify(await api("GET", "/admin/players"), null, 2));
    else if (sub === "ban" && args[1]) console.log(JSON.stringify(await api("POST", `/admin/players/${args[1]}/ban`, { reason: args.slice(2).join(" ") || "Banned via CLI" }), null, 2));
    else if (sub === "unban" && args[1]) console.log(JSON.stringify(await api("DELETE", `/admin/players/${args[1]}/ban`), null, 2));
    else { process.stderr.write("Usage: partygame players <list|ban|unban> [playerId]\n"); process.exit(1); }
  },
  async hotfix(args) {
    const sub = args[0];
    if (sub === "list") console.log(JSON.stringify(await api("GET", "/hotfix/list"), null, 2));
    else if (sub === "promote" && args[1]) console.log(JSON.stringify(await api("POST", `/hotfix/promote/${args[1]}`), null, 2));
    else if (sub === "rollback" && args[1]) console.log(JSON.stringify(await api("POST", `/hotfix/rollback/${args[1]}`), null, 2));
    else if (sub === "delete" && args[1]) console.log(JSON.stringify(await api("DELETE", `/hotfix/${args[1]}`), null, 2));
    else { process.stderr.write("Usage: partygame hotfix <list|promote|rollback|delete> [version]\n"); process.exit(1); }
  },
  async assets(args) {
    const sub = args[0];
    if (sub === "list") console.log(JSON.stringify(await api("GET", "/admin/assets"), null, 2));
    else if (sub === "create" && args[1]) {
      const name = args[1];
      const watermark = args.includes("--watermark");
      const vi = args.findIndex(a => a.startsWith("--variants="));
      const variants = vi !== -1 ? parseInt(args[vi].split("=")[1]) || 4 : 4;
      console.log(JSON.stringify(await api("POST", "/admin/assets", { name, watermarkEnabled: watermark, variantCount: variants }), null, 2));
    } else if (sub === "delete" && args[1]) console.log(JSON.stringify(await api("DELETE", `/admin/assets/${args[1]}`), null, 2));
    else { process.stderr.write("Usage: partygame assets <list|create|delete> [name|id] [--watermark] [--variants=N]\n"); process.exit(1); }
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmd || cmd === "help" || cmd === "-h") {
  console.log(`PartyGame CLI — AI-agent-friendly platform config

Usage: npx partygame <command>

Commands:
  status                      Get full platform state
  config                      Get agent-config manifest
  openapi                     Print OpenAPI spec URL
  feature <name> <on|off>     Toggle a feature flag
  players list                List all players
  players ban <playerId>      Ban a player
  players unban <playerId>    Unban a player
  hotfix list                 List hotfixes
  hotfix promote <version>    Promote a hotfix
  hotfix rollback <version>   Rollback
  hotfix delete <version>     Delete a hotfix
  assets list                 List all assets
  assets create <name>        Create asset [--watermark] [--variants=N]
  assets delete <id>          Delete an asset

Env: PARTYGAME_URL (default: http://localhost:8787), PARTYGAME_TOKEN`);
  process.exit(0);
}

const handler = commands[cmd];
if (!handler) { process.stderr.write(`Unknown command: ${cmd}\n`); process.exit(1); }
handler(args).catch(err => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
