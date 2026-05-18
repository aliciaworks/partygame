/**
 * Prometheus Metrics
 * Tracks key performance indicators and business metrics
 * Exports metrics in Prometheus text format for scraping
 */

import { Context } from 'hono';
import { getLogger } from './logger';

const logger = getLogger();

export interface MetricCounter {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricGauge {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

export interface MetricHistogram {
  name: string;
  help: string;
  buckets: Record<string, number>;
  sum: number;
  count: number;
  labels: Record<string, string>;
}

/**
 * In-memory metric storage
 * In production, consider using a proper metrics library like prom-client
 */
const metrics = {
  // Counters (monotonically increasing)
  httpRequests: new Map<string, number>(),
  httpErrors: new Map<string, number>(),
  rateLimitViolations: new Map<string, number>(),
  roomsCreated: 0,
  playersJoined: 0,
  itemsPurchased: 0,

  // Gauges (can go up/down)
  activeRooms: 0,
  activePlayers: 0,
  activeDurableObjects: 0,

  // Histograms (track distribution)
  tickDurations: [] as number[],
  requestDurations: [] as number[],
  databaseQueryDurations: [] as number[],
};

/**
 * Record HTTP request metric
 */
export function recordHttpRequest(method: string, path: string, status: number, duration: number) {
  const key = `${method}:${path}:${status}`;
  metrics.httpRequests.set(key, (metrics.httpRequests.get(key) ?? 0) + 1);

  if (status >= 400) {
    metrics.httpErrors.set(key, (metrics.httpErrors.get(key) ?? 0) + 1);
  }

  metrics.requestDurations.push(duration);

  // Keep only last 1000 durations to avoid memory leak
  if (metrics.requestDurations.length > 1000) {
    metrics.requestDurations = metrics.requestDurations.slice(-1000);
  }
}

/**
 * Record rate limit violation
 */
export function recordRateLimitViolation(limitType: string, key: string) {
  const metricKey = `${limitType}:${key}`;
  metrics.rateLimitViolations.set(metricKey, (metrics.rateLimitViolations.get(metricKey) ?? 0) + 1);
}

/**
 * Record room creation
 */
export function recordRoomCreated() {
  metrics.roomsCreated++;
  metrics.activeRooms++;
}

/**
 * Record room destruction
 */
export function recordRoomDestroyed() {
  metrics.activeRooms = Math.max(0, metrics.activeRooms - 1);
}

/**
 * Record player join
 */
export function recordPlayerJoined() {
  metrics.playersJoined++;
  metrics.activePlayers++;
}

/**
 * Record player leave
 */
export function recordPlayerLeft() {
  metrics.activePlayers = Math.max(0, metrics.activePlayers - 1);
}

/**
 * Record item purchase
 */
export function recordItemPurchased() {
  metrics.itemsPurchased++;
}

/**
 * Record tick duration
 */
export function recordTickDuration(duration: number) {
  metrics.tickDurations.push(duration);

  // Keep only last 1000 durations
  if (metrics.tickDurations.length > 1000) {
    metrics.tickDurations = metrics.tickDurations.slice(-1000);
  }
}

/**
 * Record database query duration
 */
export function recordDatabaseQueryDuration(duration: number) {
  metrics.databaseQueryDurations.push(duration);

  // Keep only last 1000 durations
  if (metrics.databaseQueryDurations.length > 1000) {
    metrics.databaseQueryDurations = metrics.databaseQueryDurations.slice(-1000);
  }
}

/**
 * Calculate percentile from array of values
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate average from array of values
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Format metrics in Prometheus text format
 */
function formatPrometheusMetrics(): string {
  const lines: string[] = [];

  // HTTP Requests
  lines.push('# HELP partygame_http_requests_total Total HTTP requests');
  lines.push('# TYPE partygame_http_requests_total counter');
  metrics.httpRequests.forEach((value, key) => {
    const [method, path, status] = key.split(':');
    lines.push(
      `partygame_http_requests_total{method="${method}",path="${path}",status="${status}"} ${value}`
    );
  });

  // HTTP Errors
  lines.push('# HELP partygame_http_errors_total Total HTTP errors');
  lines.push('# TYPE partygame_http_errors_total counter');
  metrics.httpErrors.forEach((value, key) => {
    const [method, path, status] = key.split(':');
    lines.push(
      `partygame_http_errors_total{method="${method}",path="${path}",status="${status}"} ${value}`
    );
  });

  // Rate Limit Violations
  lines.push('# HELP partygame_rate_limit_violations_total Rate limit violations');
  lines.push('# TYPE partygame_rate_limit_violations_total counter');
  metrics.rateLimitViolations.forEach((value, key) => {
    const [limitType, limitKey] = key.split(':');
    lines.push(`partygame_rate_limit_violations{type="${limitType}",key="${limitKey}"} ${value}`);
  });

  // Active Rooms
  lines.push('# HELP partygame_active_rooms Current active game rooms');
  lines.push('# TYPE partygame_active_rooms gauge');
  lines.push(`partygame_active_rooms ${metrics.activeRooms}`);

  // Active Players
  lines.push('# HELP partygame_active_players Current active players');
  lines.push('# TYPE partygame_active_players gauge');
  lines.push(`partygame_active_players ${metrics.activePlayers}`);

  // Rooms Created (lifetime)
  lines.push('# HELP partygame_rooms_created_total Lifetime room creations');
  lines.push('# TYPE partygame_rooms_created_total counter');
  lines.push(`partygame_rooms_created_total ${metrics.roomsCreated}`);

  // Players Joined (lifetime)
  lines.push('# HELP partygame_players_joined_total Lifetime player joins');
  lines.push('# TYPE partygame_players_joined_total counter');
  lines.push(`partygame_players_joined_total ${metrics.playersJoined}`);

  // Items Purchased
  lines.push('# HELP partygame_items_purchased_total Items purchased');
  lines.push('# TYPE partygame_items_purchased_total counter');
  lines.push(`partygame_items_purchased_total ${metrics.itemsPurchased}`);

  // Tick Duration Histogram
  if (metrics.tickDurations.length > 0) {
    lines.push('# HELP partygame_tick_duration_ms Game tick duration in milliseconds');
    lines.push('# TYPE partygame_tick_duration_ms histogram');
    const buckets = [10, 20, 50, 100, 200, 500, 1000];
    buckets.forEach((bucket) => {
      const count = metrics.tickDurations.filter((d) => d <= bucket).length;
      lines.push(`partygame_tick_duration_ms_bucket{le="${bucket}"} ${count}`);
    });
    lines.push(`partygame_tick_duration_ms_bucket{le="+Inf"} ${metrics.tickDurations.length}`);
    const sum = metrics.tickDurations.reduce((a, b) => a + b, 0);
    lines.push(`partygame_tick_duration_ms_sum ${sum}`);
    lines.push(`partygame_tick_duration_ms_count ${metrics.tickDurations.length}`);

    // Calculate and expose P50, P95, P99
    lines.push(`# HELP partygame_tick_duration_p50_ms Tick duration P50 (median)`);
    lines.push(`# TYPE partygame_tick_duration_p50_ms gauge`);
    lines.push(`partygame_tick_duration_p50_ms ${percentile(metrics.tickDurations, 50)}`);

    lines.push(`# HELP partygame_tick_duration_p95_ms Tick duration P95`);
    lines.push(`# TYPE partygame_tick_duration_p95_ms gauge`);
    lines.push(`partygame_tick_duration_p95_ms ${percentile(metrics.tickDurations, 95)}`);

    lines.push(`# HELP partygame_tick_duration_p99_ms Tick duration P99`);
    lines.push(`# TYPE partygame_tick_duration_p99_ms gauge`);
    lines.push(`partygame_tick_duration_p99_ms ${percentile(metrics.tickDurations, 99)}`);
  }

  // Request Duration Histogram
  if (metrics.requestDurations.length > 0) {
    lines.push('# HELP partygame_request_duration_ms HTTP request duration');
    lines.push('# TYPE partygame_request_duration_ms histogram');
    const buckets = [10, 50, 100, 250, 500, 1000, 2500];
    buckets.forEach((bucket) => {
      const count = metrics.requestDurations.filter((d) => d <= bucket).length;
      lines.push(`partygame_request_duration_ms_bucket{le="${bucket}"} ${count}`);
    });
    lines.push(`partygame_request_duration_ms_bucket{le="+Inf"} ${metrics.requestDurations.length}`);
    const sum = metrics.requestDurations.reduce((a, b) => a + b, 0);
    lines.push(`partygame_request_duration_ms_sum ${sum}`);
    lines.push(`partygame_request_duration_ms_count ${metrics.requestDurations.length}`);
  }

  // Database Query Duration Histogram
  if (metrics.databaseQueryDurations.length > 0) {
    lines.push('# HELP partygame_db_query_duration_ms Database query duration');
    lines.push('# TYPE partygame_db_query_duration_ms histogram');
    const buckets = [1, 5, 10, 25, 50, 100, 250];
    buckets.forEach((bucket) => {
      const count = metrics.databaseQueryDurations.filter((d) => d <= bucket).length;
      lines.push(`partygame_db_query_duration_ms_bucket{le="${bucket}"} ${count}`);
    });
    lines.push(
      `partygame_db_query_duration_ms_bucket{le="+Inf"} ${metrics.databaseQueryDurations.length}`
    );
    const sum = metrics.databaseQueryDurations.reduce((a, b) => a + b, 0);
    lines.push(`partygame_db_query_duration_ms_sum ${sum}`);
    lines.push(`partygame_db_query_duration_ms_count ${metrics.databaseQueryDurations.length}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Hono middleware to record request metrics
 */
export async function metricsMiddleware(c: Context, next: () => Promise<void>) {
  const startTime = Date.now();

  try {
    await next();
  } finally {
    const duration = Date.now() - startTime;
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const status = c.res.status;

    recordHttpRequest(method, path, status, duration);
  }
}

/**
 * Handler for Prometheus metrics endpoint
 */
export function handleMetricsEndpoint(c: Context) {
  const metricsText = formatPrometheusMetrics();
  return new Response(metricsText, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Get current metrics snapshot (for debugging/admin)
 */
export function getMetricsSnapshot() {
  return {
    activeRooms: metrics.activeRooms,
    activePlayers: metrics.activePlayers,
    roomsCreated: metrics.roomsCreated,
    playersJoined: metrics.playersJoined,
    itemsPurchased: metrics.itemsPurchased,
    tickDurationStats: {
      p50: metrics.tickDurations.length > 0 ? percentile(metrics.tickDurations, 50) : 0,
      p95: metrics.tickDurations.length > 0 ? percentile(metrics.tickDurations, 95) : 0,
      p99: metrics.tickDurations.length > 0 ? percentile(metrics.tickDurations, 99) : 0,
      avg: average(metrics.tickDurations),
    },
    requestDurationStats: {
      p50: metrics.requestDurations.length > 0 ? percentile(metrics.requestDurations, 50) : 0,
      p95: metrics.requestDurations.length > 0 ? percentile(metrics.requestDurations, 95) : 0,
      p99: metrics.requestDurations.length > 0 ? percentile(metrics.requestDurations, 99) : 0,
      avg: average(metrics.requestDurations),
    },
  };
}
