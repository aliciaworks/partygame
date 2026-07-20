/**
 * Standardized error response handler
 * Prevents information leakage while providing useful error codes
 */

export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ErrorResponse {
  error: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create standardized error response
 * Never includes stack traces or internal implementation details
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ErrorResponse {
  const response: ErrorResponse = {
    error: code,
    message,
  };

  if (details) {
    response.details = details;
  }

  return response;
}

/**
 * Map common HTTP errors to standard format
 */
export function handleValidationError(cause: unknown): ErrorResponse {
  if (cause instanceof Error) {
    // Parse validation errors without exposing internals
    const message = cause.message.toLowerCase();
    if (message.includes("json") || message.includes("parse")) {
      return createErrorResponse("INVALID_INPUT", "Invalid JSON format");
    }
  }

  return createErrorResponse("INVALID_INPUT", "Invalid request format");
}

export function handleUnauthorized(reason?: string): ErrorResponse {
  return createErrorResponse("UNAUTHORIZED", reason ?? "Authentication required");
}

export function handleForbidden(reason?: string): ErrorResponse {
  return createErrorResponse("FORBIDDEN", reason ?? "Insufficient permissions");
}

export function handleNotFound(resource?: string): ErrorResponse {
  return createErrorResponse("NOT_FOUND", `${resource ?? "Resource"} not found`);
}

export function handleConflict(reason?: string): ErrorResponse {
  return createErrorResponse("CONFLICT", reason ?? "Resource already exists");
}

export function handleRateLimited(retryAfter?: number): ErrorResponse {
  return createErrorResponse("RATE_LIMITED", "Too many requests, please try again later", {
    retryAfter,
  });
}

export function handleInternalError(error?: unknown): ErrorResponse {
  // Log full error server-side, but don't expose to client
  if (error instanceof Error) {
    console.error("[Internal Error]", error.message, error.stack);
  } else {
    console.error("[Internal Error]", error);
  }

  return createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred");
}

/**
 * Map error to HTTP status code
 */
export function errorCodeToStatus(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    INVALID_INPUT: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
  };

  return statusMap[code] ?? 500;
}
