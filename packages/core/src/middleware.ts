import { Context, Next } from "hono";
import { createChildLogger } from "./logger";

// Simple In-Memory Rate Limiter Map for demonstration.
// In a real globally distributed Cloudflare Worker, you should use
// @hono/rate-limiter paired with Cloudflare KV or Durable Objects
// to ensure distributed consistency.

const rateLimitCache = new Map<string, { count: number; lastReset: number }>();

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  getIdentifier?: (c: Context) => string;
  skipSuccessfulRequests?: boolean;
  keyPrefix?: string;
}

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute
const MAX_REQUESTS_PER_PLAYER = 30; // 30 requests per player per minute
const MAX_REQUESTS_PER_ROOM = 500; // 500 requests per room per minute

/**
 * Rate Limiting Middleware for Hono APIs
 */
export function createRateLimiter(options: RateLimiterOptions) {
  return async (c: Context, next: Next) => {
    const identifier =
      options.getIdentifier?.(c) ||
      c.req.header("cf-connecting-ip") ||
      "unknown-ip";
    const now = Date.now();
    const cacheKey = options.keyPrefix
      ? `${options.keyPrefix}:${identifier}`
      : identifier;

    const record = rateLimitCache.get(cacheKey);

    if (!record || now - record.lastReset > options.windowMs) {
      rateLimitCache.set(cacheKey, { count: 1, lastReset: now });
      await next();
      return;
    }

    if (record.count >= options.maxRequests) {
      const logger = createChildLogger({ identifier });
      logger.warn({
        event: "rate_limit_exceeded",
        identifier,
        limit: options.maxRequests,
      });

      return c.json(
        { success: false, error: "Too many requests. Please try again later." },
        429,
        {
          "Retry-After": String(Math.ceil(options.windowMs / 1000)),
          "X-RateLimit-Limit": String(options.maxRequests),
          "X-RateLimit-Remaining": String(
            Math.max(0, options.maxRequests - record.count)
          ),
        }
      );
    }

    record.count++;
    await next();
  };
}

/**
 * IP-based rate limiter (default).
 */
export const rateLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  maxRequests: MAX_REQUESTS,
  keyPrefix: "ip",
});

/**
 * Player-aware rate limiter.
 * Limits requests per authenticated player (from session token).
 */
export const playerRateLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  maxRequests: MAX_REQUESTS_PER_PLAYER,
  getIdentifier: (c: Context) => {
    // Extract playerId from auth header, session, or query param
    const authHeader = c.req.header("authorization");
    const playerId = c.req.query("playerId") || c.req.header("x-player-id");
    return playerId || authHeader?.split(" ")[1]?.slice(0, 16) || "unknown";
  },
  keyPrefix: "player",
});

/**
 * Room-aware rate limiter.
 * Limits requests per game room to prevent single-room flooding.
 */
export const roomRateLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  maxRequests: MAX_REQUESTS_PER_ROOM,
  getIdentifier: (c: Context) => {
    const roomId = c.req.query("roomId") || c.req.header("x-room-id");
    return roomId || "unknown-room";
  },
  keyPrefix: "room",
});

/**
 * Cleanup old rate limit entries every 5 minutes.
 * Prevents unbounded memory growth.
 */
export function startRateLimiterCleanup(intervalMs: number = 300000) {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of rateLimitCache.entries()) {
      if (now - record.lastReset > WINDOW_MS * 2) {
        rateLimitCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      const logger = createChildLogger({});
      logger.debug({
        event: "rate_limiter_cleanup",
        entries_removed: cleaned,
      });
    }
  }, intervalMs);
}
