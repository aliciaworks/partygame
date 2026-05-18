import { Context, Next } from "hono";

// Simple In-Memory Rate Limiter Map for demonstration.
// In a real globally distributed Cloudflare Worker, you should use
// @hono/rate-limiter paired with Cloudflare KV or Durable Objects 
// to ensure distributed consistency.

const rateLimitCache = new Map<string, { count: number; lastReset: number }>();

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

/**
 * Rate Limiting Middleware for Hono APIs
 */
export const rateLimiter = async (c: Context, next: Next) => {
  // Use IP address or User ID as the identifier
  const ip = c.req.header("cf-connecting-ip") || "unknown-ip";
  const now = Date.now();

  const record = rateLimitCache.get(ip);

  if (!record || now - record.lastReset > WINDOW_MS) {
    // Reset or initialize window
    rateLimitCache.set(ip, { count: 1, lastReset: now });
    await next();
    return;
  }

  if (record.count >= MAX_REQUESTS) {
    // Rate limit exceeded
    return c.json(
      { success: false, error: "Too many requests. Please try again later." },
      429
    );
  }

  // Increment count
  record.count++;
  await next();
};
