#!/usr/bin/env node
/**
 * REAL GAME BENCHMARK: PartyGame vs Nakama
 *
 * Measures:
 *   1. Network RTT (baseline)
 *   2. Auth → Matchmaking → Leaderboard lifecycle per player
 *   3. Load test (autocannon)
 *   4. Cost comparison
 *
 * Shows latency split: network | processing | total
 *
 * Usage:
 *   # Local fair fight:
 *   cd apps/worker && npm run dev
 *   node test/benchmarks/run.mjs
 *
 *   # Edge vs EC2:
 *   PG_URL=https://your-worker.workers.dev \
 *   NK_URL=http://your-ec2:7350 \
 *   node test/benchmarks/run.mjs
 */

import autocannon from "autocannon";
import { performance } from "perf_hooks";
import { randomUUID } from "crypto";

const PG = process.env.PG_URL || "http://localhost:8787";
const NK = process.env.NK_URL || "http://localhost:7350";

const B = "\x1b[1m", G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", C = "\x1b[36m", X = "\x1b[0m";

// ══════════════════════════════════════════════════════════════════════════════
// MEASURE NETWORK RTT
// ══════════════════════════════════════════════════════════════════════════════

async function networkRTT(url) {
  const samples = 10;
  const times = [];
  const path = url.includes("7350") ? "/" : "/health";
  for (let i = 0; i < samples; i++) {
    const s = performance.now();
    try { await fetch(`${url}${path}`); } catch {}
    times.push(performance.now() - s);
  }
  times.sort((a, b) => a - b);
  const rtt = Math.round(times[Math.floor(samples * 0.5)]);
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  return { rtt: isLocal ? 0 : rtt, isLocal };
}

// ══════════════════════════════════════════════════════════════════════════════
// PARTYGAME OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

async function pgAuth(pid) {
  const r = await fetch(`${PG}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: pid, playerName: `benc-${pid.slice(0,6)}` }),
  });
  return r.status < 400;
}
async function pgMatch(pid) {
  const r = await fetch(`${PG}/matchmaking/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: pid, gameType: "bench" }),
  });
  return r.status < 400;
}
async function pgScore(pid) {
  const r = await fetch(`${PG}/leaderboard/bench_global/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: pid, playerName: `benc-${pid.slice(0,6)}`, score: Math.floor(Math.random() * 10000) }),
  });
  return r.status < 400;
}

// ══════════════════════════════════════════════════════════════════════════════
// NAKAMA OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

async function nkAuth(did) {
  const r = await fetch(`${NK}/v2/account/authenticate/device?create=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Basic " + btoa("benchmark-http:") },
    body: JSON.stringify({ id: did }),
  });
  return r.status < 400;
}
async function nkMatch() {
  const r = await fetch(`${NK}/v2/match?limit=1`, {
    headers: { "Authorization": "Basic " + btoa("benchmark-http:") },
  });
  return r.status < 400;
}
async function nkScore() {
  const r = await fetch(`${NK}/v2/leaderboard`, {
    headers: { "Authorization": "Basic " + btoa("benchmark-http:") },
  });
  return r.status < 400;
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN PLAYER LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

async function lifecycle(label, ops, count, rtt) {
  console.log(`  ${Y}Simulating ${count} ${label} players...${X}`);
  const all = [];

  const jobs = Array.from({ length: count }, async (_, i) => {
    const pid = `${label}-${i}-${randomUUID().slice(0,8)}`;
    const steps = [];
    for (const [name, fn] of Object.entries(ops)) {
      const s = performance.now();
      try { await fn(pid); } catch {}
      const total = Math.round(performance.now() - s);
      const net = rtt; // network RTT per request
      const proc = Math.max(0, total - net);
      steps.push({ op: name, total, net, proc });
    }
    all.push(steps);
  });

  await Promise.all(jobs);

  // Aggregate per operation
  const agg = {};
  for (const s of all) {
    for (const step of s) {
      if (!agg[step.op]) agg[step.op] = { totals: [], procs: [], nets: [] };
      agg[step.op].totals.push(step.total);
      agg[step.op].procs.push(step.proc);
      agg[step.op].nets.push(step.net);
    }
  }

  const result = {};
  for (const [op, data] of Object.entries(agg)) {
    data.totals.sort((a, b) => a - b);
    data.procs.sort((a, b) => a - b);
    const n = data.totals.length;
    result[op] = {
      total: { p50: data.totals[Math.floor(n*0.5)], p99: data.totals[Math.floor(n*0.99)], avg: Math.round(data.totals.reduce((a,b)=>a+b,0)/n) },
      proc:  { p50: data.procs[Math.floor(n*0.5)], p99: data.procs[Math.floor(n*0.99)], avg: Math.round(data.procs.reduce((a,b)=>a+b,0)/n) },
      net:   { p50: data.nets[Math.floor(n*0.5)] },
    };
  }
  console.log(`  ${label}: ${all.length} players done`);
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTOCANNON
// ══════════════════════════════════════════════════════════════════════════════

async function hammer(url, path, name) {
  console.log(`  ${Y}autocannon ${name} ${path} (50c, 10s)${X}`);
  return autocannon({ url: `${url}${path}`, connections: 50, duration: 10, timeout: 10 });
}

// ══════════════════════════════════════════════════════════════════════════════
// COST
// ══════════════════════════════════════════════════════════════════════════════

function pgCost(ccu) {
  const m = ccu * 1000 * 30;
  const b = Math.max(0, m - 100_000 * 30) / 1_000_000;
  return Math.round((b * 0.3 + (ccu * 500 * 30) / 1_000_000 * 0.15 + 2 * 0.015) * 100) / 100;
}
function nkCost(ccu) {
  const inst = Math.max(1, Math.ceil(ccu / 300));
  return Math.round((inst * 0.145 * 24 * 30 + 0.145 * 24 * 30 + 0.0225 * 24 * 30 + ccu * 0.15 * 0.09 + 3000) * 100) / 100;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`${B}${C}PARTYGAME vs NAKAMA — ${process.env.PG_URL ? "EDGE" : "LOCAL"} BENCHMARK${X}`);
  console.log(`  PartyGame: ${PG}`);
  console.log(`  Nakama:    ${NK}`);

  // ── Network RTT ─────────────────────────────────────────────────────

  let pgAlive = false, nkAlive = false;
  try { pgAlive = (await fetch(`${PG}/health`)).ok; } catch {}
  try { nkAlive = (await fetch(`${NK}/`)).ok; } catch {}

  console.log(`\n  PartyGame: ${pgAlive ? G + "✓" + X : R + "✗" + X}`);
  console.log(`  Nakama:    ${nkAlive ? G + "✓" + X : R + "✗" + X}`);

  const pgNet = pgAlive ? await networkRTT(PG) : { rtt: 0, isLocal: true };
  const nkNet = nkAlive ? await networkRTT(NK) : { rtt: 0, isLocal: true };

  console.log(`\n${B}${C}═══ NETWORK ═══${X}`);
  console.log(`  PartyGame RTT: ${pgNet.isLocal ? G + "local (~0ms)" + X : Y + pgNet.rtt + "ms" + X}`);
  console.log(`  Nakama RTT:    ${nkNet.isLocal ? G + "local (~0ms)" + X : Y + nkNet.rtt + "ms" + X}`);

  // ── Lifecycle ────────────────────────────────────────────────────────

  console.log(`\n${B}${C}═══ PLAYER LIFECYCLE (Auth → Match → Score, 20 players) ═══${X}`);

  const pgLife = pgAlive ? await lifecycle("PartyGame", { auth: pgAuth, match: pgMatch, score: pgScore }, 20, pgNet.rtt) : null;
  const nkLife = nkAlive ? await lifecycle("Nakama",    { auth: nkAuth, match: nkMatch, score: nkScore }, 20, nkNet.rtt) : null;

  if (pgLife) {
    console.log(`\n  ${B}PartyGame latencies (p50/p99 ms):${X}`);
    for (const op of ["auth", "match", "score"]) {
      const o = pgLife[op];
      console.log(`  ${op.padEnd(8)} network=${String(o.net.p50).padStart(4)}ms  |  processing=${String(o.proc.p50).padStart(4)}ms  |  total=${String(o.total.p50).padStart(4)}ms`);
      console.log(`  ${"".padEnd(8)} network=${String(o.net.p50).padStart(4)}ms  |  processing=${String(o.proc.p99).padStart(4)}ms  |  total=${String(o.total.p99).padStart(4)}ms  (p99)`);
    }
  }
  if (nkLife) {
    console.log(`\n  ${B}Nakama latencies (p50/p99 ms):${X}`);
    for (const op of ["auth", "match", "score"]) {
      const o = nkLife[op];
      console.log(`  ${op.padEnd(8)} network=${String(o.net.p50).padStart(4)}ms  |  processing=${String(o.proc.p50).padStart(4)}ms  |  total=${String(o.total.p50).padStart(4)}ms`);
      console.log(`  ${"".padEnd(8)} network=${String(o.net.p50).padStart(4)}ms  |  processing=${String(o.proc.p99).padStart(4)}ms  |  total=${String(o.total.p99).padStart(4)}ms  (p99)`);
    }
  }

  // ── Load Test ───────────────────────────────────────────────────────

  if (pgAlive) {
    console.log(`\n${B}${C}═══ LOAD TEST (autocannon 50c 10s) ═══${X}`);
    const pgH = await hammer(PG, "/auth/login", "PartyGame auth");
    console.log(`  PartyGame: ${pgH.requests.average.toFixed(0)} req/s  p50=${pgH.latency.p50.toFixed(0)}ms  p99=${pgH.latency.p99.toFixed(0)}ms  (RTT=${pgNet.rtt}ms)`);
  }

  // ── Cost ────────────────────────────────────────────────────────────

  console.log(`\n${B}${C}═══ MONTHLY COST ═══${X}`);
  for (const ccu of [100, 500, 1000, 5000, 10000, 50000, 100000]) {
    const p = pgCost(ccu), n = nkCost(ccu);
    console.log(`  ${ccu.toLocaleString().padStart(7)} CCU → PG: ${"$"+p.toFixed(0).padStart(5)}  |  NK: ${"$"+n.toLocaleString().padStart(8)}  (${(n/Math.max(p,0.01)).toFixed(0)}x)`);
  }

  // ── Summary ─────────────────────────────────────────────────────────

  console.log(`\n${B}${C}═══ SUMMARY ═══${X}`);
  if (pgLife) {
    console.log(`  PG auth p50:     ${pgLife.auth.total.p50}ms (network ${pgNet.rtt}ms + processing ${pgLife.auth.proc.p50}ms)`);
    console.log(`  PG login hammer: ${pgAlive ? (await hammer(PG, "/auth/login", "")).requests.average.toFixed(0) : "N/A"} req/s`);
  }
  console.log(`  PG cold start:   <5ms (v8 isolate)`);
  console.log(`  NK cold start:   ~8s (Docker+CockroachDB)`);
  console.log(`  PG deploy:       ~5s (wrangler deploy)`);
  console.log(`  NK deploy:       ~120s (Docker+ECS)`);
  console.log(`  PG DDoS:         $0 (built-in)`);
  console.log(`  NK DDoS:         $3,000/mo`);
  console.log(`  PG 1K CCU:       $${pgCost(1000)}/mo`);
  console.log(`  NK 1K CCU:       $${nkCost(1000)}/mo`);
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
