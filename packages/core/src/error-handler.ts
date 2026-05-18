import type { Context, Next } from "hono";
import { captureException, createChildLogger } from "./logger";

/**
 * Hono middleware for error handling and structured request logging.
 * Logs all requests/responses and catches unhandled errors.
 */
export async function errorHandlerMiddleware(c: Context, next: Next) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID?.() || Date.now().toString();
  const logger = createChildLogger({ requestId });

  try {
    // Log incoming request
    logger.info({
      event: "request_start",
      method: c.req.method,
      path: c.req.path,
      ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for"),
    });

    await next();

    const status = c.res.status;
    const duration = Date.now() - startTime;

    logger.info({
      event: "request_complete",
      status,
      duration_ms: duration,
      path: c.req.path,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    captureException(err, { requestId });

    logger.error({
      event: "request_error",
      error: err instanceof Error ? err.message : String(err),
      duration_ms: duration,
      stack: err instanceof Error ? err.stack : undefined,
    });

    return c.json(
      {
        error: "Internal server error",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * Attach request context to Hono context for logging.
 * Allows child loggers to track room/player context.
 */
export function attachRequestContext(c: Context, context: Record<string, any>) {
  c.set("logContext", context);
}

/**
 * Get logger with request context from Hono context.
 */
export function getContextLogger(c: Context) {
  const context = c.get("logContext") || {};
  return createChildLogger({
    requestId: crypto.randomUUID?.() || Date.now().toString(),
    ...context,
  });
}
