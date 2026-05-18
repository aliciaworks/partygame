import pino from "pino";

export interface LogContext {
  roomId?: string;
  playerId?: string;
  requestId?: string;
  [key: string]: any;
}

let loggerInstance: ReturnType<typeof pino> | null = null;

/**
 * Initialize the logger.
 * Call this once at app startup.
 */
export function initializeLogger(options?: {
  isDev?: boolean;
  serviceName?: string;
}) {
  const isDev = options?.isDev ?? true;
  const serviceName = options?.serviceName ?? "partygame";

  loggerInstance = pino({
    name: serviceName,
    level: isDev ? "debug" : "info",
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        }
      : undefined,
  });

  return loggerInstance;
}

/**
 * Get the logger instance.
 * Returns a singleton after initializeLogger() is called.
 */
export function getLogger() {
  if (!loggerInstance) {
    loggerInstance = initializeLogger();
  }
  return loggerInstance;
}

/**
 * Create a child logger with context.
 * Useful for tracking requests, rooms, players.
 */
export function createChildLogger(context: LogContext) {
  const logger = getLogger();
  return logger.child(context);
}

/**
 * Capture exceptions for error tracking (Sentry-compatible).
 * In production, integrate with Sentry:
 *   import * as Sentry from '@sentry/node';
 *   if (process.env.SENTRY_DSN) Sentry.captureException(err);
 */
export function captureException(
  err: unknown,
  context?: LogContext
): void {
  const logger = context ? createChildLogger(context) : getLogger();
  logger.error(err instanceof Error ? err : new Error(String(err)));

  // TODO: Integrate with Sentry in production
  // if (typeof process !== 'undefined' && process.env.SENTRY_DSN) {
  //   import('@sentry/node').then(({ captureException }) => {
  //     captureException(err, { contexts: { custom: context } });
  //   });
  // }
}

/**
 * Log a structured event.
 */
export function logEvent(
  eventName: string,
  data: any = {},
  context?: LogContext
) {
  const logger = context ? createChildLogger(context) : getLogger();
  logger.info({ event: eventName, ...data });
}
