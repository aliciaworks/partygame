import type { Context, Next } from "hono";
import { z } from "zod";
import { getContextLogger } from "./error-handler";
import type { MovePayload } from "./room-logic";

/**
 * Input validation schemas for common request types.
 * Uses Zod for runtime type checking.
 */

export const MovePayloadSchema = z.object({
  x: z.number().min(-10).max(10),
  y: z.number().min(-10).max(10),
}) as z.ZodSchema<MovePayload>;

export const PurchaseRequestSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  playerId: z.string().min(1),
});

export const AuthLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RoomJoinSchema = z.object({
  playerId: z.string().min(1).max(100),
  roomId: z.string().min(1).max(100),
  sessionToken: z.string().optional(),
});

export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;
export type AuthLogin = z.infer<typeof AuthLoginSchema>;
export type RoomJoin = z.infer<typeof RoomJoinSchema>;

/**
 * Middleware to validate JSON request body against a Zod schema.
 */
export function validateJsonBody<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        const logger = getContextLogger(c);
        logger.warn({
          event: "validation_error",
          path: c.req.path,
          errors: result.error.issues,
        });

        return c.json(
          {
            error: "Validation failed",
            details: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          { status: 400 }
        );
      }

      // Attach validated data to context
      c.set("validatedBody", result.data);
      await next();
    } catch (err) {
      const logger = getContextLogger(c);
      logger.error({
        event: "json_parse_error",
        error: err instanceof Error ? err.message : String(err),
      });

      return c.json(
        {
          error: "Invalid JSON",
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Middleware to validate query parameters against a Zod schema.
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    const query = Object.fromEntries(
      [...new URL(c.req.url).searchParams.entries()]
    );
    const result = schema.safeParse(query);

    if (!result.success) {
      const logger = getContextLogger(c);
      logger.warn({
        event: "query_validation_error",
        path: c.req.path,
        errors: result.error.issues,
      });

      return c.json(
        {
          error: "Invalid query parameters",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    c.set("validatedQuery", result.data);
    await next();
  };
}

/**
 * Middleware to enforce maximum request body size.
 * Prevents unbounded uploads and DoS attacks.
 */
export function limitBodySize(maxBytes: number = 1024 * 100) {
  // 100 KB default
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header("content-length");

    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      const logger = getContextLogger(c);
      logger.warn({
        event: "request_body_too_large",
        size: parseInt(contentLength, 10),
        max: maxBytes,
      });

      return c.json(
        {
          error: `Request body exceeds ${maxBytes} bytes`,
        },
        { status: 413 }
      );
    }

    await next();
  };
}

/**
 * Middleware to add security headers to responses.
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  // Prevent MIME type sniffing
  c.header("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  c.header("X-XSS-Protection", "1; mode=block");

  // Prevent clickjacking
  c.header("X-Frame-Options", "DENY");

  // Content Security Policy
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  // Prevent referrer leakage
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Enforce HTTPS
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

/**
 * Get validated body from context.
 */
export function getValidatedBody<T>(c: Context): T {
  return c.get("validatedBody");
}

/**
 * Get validated query from context.
 */
export function getValidatedQuery<T>(c: Context): T {
  return c.get("validatedQuery");
}
