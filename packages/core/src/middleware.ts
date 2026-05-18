import { Context, Next } from "hono";

// Simple In-Memory Rate Limiter Map for demonstration.
// In a real globally distributed Cloudflare Worker, you should use
// @hono/rate-limiter paired with Cloudflare KV or Durable Objects
// to ensure distributed consistency.

const rateLimitCache = new Map<string, { count: number; lastReset: number }>();

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  getIdentifier?: (c: Context) => string;
}

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

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

    const record = rateLimitCache.get(identifier);

    if (!record || now - record.lastReset > options.windowMs) {
      rateLimitCache.set(identifier, { count: 1, lastReset: now });
      await next();
      return;
    }

    if (record.count >= options.maxRequests) {
      return c.json(
        { success: false, error: "Too many requests. Please try again later." },
        429,
        { "Retry-After": String(Math.ceil(options.windowMs / 1000)) },
      );
    }

    record.count++;
    await next();
  };
}

export const rateLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  maxRequests: MAX_REQUESTS,
});
