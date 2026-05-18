import type { Context } from "hono";

/**
 * Health check endpoints for Cloudflare load balancers and uptime monitoring.
 * Provides /health (liveness) and /ready (readiness) probes.
 */

export interface HealthCheckStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database?: boolean;
    durableObject?: boolean;
    cache?: boolean;
  };
  uptime_ms: number;
}

let startTime = Date.now();

/**
 * Reset startup time (useful for testing).
 */
export function resetHealthCheckTimer() {
  startTime = Date.now();
}

/**
 * Simple liveness probe.
 * Returns 200 if service is running.
 */
export async function handleHealthCheck(c: Context): Promise<Response> {
  const uptime = Date.now() - startTime;

  // If uptime < 5 seconds, return 503 (warming up)
  if (uptime < 5000) {
    return c.json(
      {
        status: "unhealthy",
        message: "Service warming up",
        uptime_ms: uptime,
      },
      { status: 503 }
    );
  }

  return c.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime_ms: uptime,
    },
    { status: 200 }
  );
}

/**
 * Readiness probe.
 * Returns 200 only if all dependencies are ready.
 * For now, always returns ready (add DB checks later).
 */
export async function handleReadinessCheck(c: Context): Promise<Response> {
  const uptime = Date.now() - startTime;

  // TODO: Add actual dependency checks:
  // - D1 database connectivity
  // - Durable Object accessibility
  // - KV cache (if used)

  const checks = {
    database: true, // Placeholder
    durableObject: true, // Placeholder
    cache: true, // Placeholder
  };

  const allHealthy = Object.values(checks).every((v) => v === true);

  const status: HealthCheckStatus = {
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
    checks,
    uptime_ms: uptime,
  };

  return c.json(status, { status: allHealthy ? 200 : 503 });
}

/**
 * Deep health check with full dependency status.
 * Useful for ops dashboards.
 */
 
export async function handleDeepHealthCheck(c: Context): Promise<Response> {
  const uptime = Date.now() - startTime;

  const status: HealthCheckStatus & {
    dependencies: Record<string, any>;
    metrics?: Record<string, any>;
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
    checks: {
      database: true,
      durableObject: true,
      cache: true,
    },
    uptime_ms: uptime,
    dependencies: {
      // TODO: Add actual status checks
      database: {
        status: "connected",
        latency_ms: "N/A",
      },
      durableObject: {
        status: "reachable",
        latency_ms: "N/A",
      },
    },
    metrics: {
      // TODO: Add actual metrics
      activeRooms: 0,
      activePlayers: 0,
      requestsPerSecond: 0,
    },
  };

  return c.json(status);
}

/**
 * Metrics endpoint for Prometheus or similar monitoring.
 * Returns metrics in Prometheus text format.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Standard HTTP handler signature
export async function handleMetricsEndpoint(_c: Context): Promise<Response> {
  const uptime = Date.now() - startTime;

  // Prometheus format: # HELP, # TYPE, metric_name{labels} value
  const metrics = `# HELP partygame_uptime_ms Service uptime in milliseconds
# TYPE partygame_uptime_ms gauge
partygame_uptime_ms ${uptime}

# HELP partygame_active_rooms Number of active game rooms
# TYPE partygame_active_rooms gauge
partygame_active_rooms 0

# HELP partygame_active_players Number of players across all rooms
# TYPE partygame_active_players gauge
partygame_active_players 0

# HELP partygame_http_requests_total Total HTTP requests
# TYPE partygame_http_requests_total counter
partygame_http_requests_total 0

# HELP partygame_rate_limit_violations_total Rate limit violations
# TYPE partygame_rate_limit_violations_total counter
partygame_rate_limit_violations_total 0
`;

  return new Response(metrics, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
    },
  });
}

/**
 * SLA (Service Level Agreement) status endpoint.
 * Tracks uptime, error rates, P99 latency.
 */
export async function handleSLAStatus(c: Context): Promise<Response> {
  const uptime = Date.now() - startTime;
  const uptimePercent = Math.min(100, (uptime / (24 * 60 * 60 * 1000)) * 100); // Rough estimate

  const slaStatus = {
    period: "30d",
    uptime_percent: uptimePercent,
    error_rate_percent: 0.1, // Placeholder
    p99_latency_ms: 150, // Placeholder
    sla_target_uptime: 99.9,
    meets_sla: uptimePercent > 99.9,
    last_incident: null as string | null,
    incidents_30d: 0,
  };

  return c.json(slaStatus);
}
