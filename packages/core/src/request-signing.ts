/**
 * Request Signing & Verification
 * HMAC-SHA256 based request authentication to prevent tampering.
 * Clients must sign requests with their secret key.
 */

import { Context } from 'hono';
import { getLogger } from './logger';
import { createHmacHexSignature } from './crypto-utils';

const logger = getLogger();

/**
 * Generate HMAC signature for request
 * Algorithm: HMAC-SHA256(method + path + body + timestamp, secret)
 */
export async function generateRequestSignature(
  method: string,
  path: string,
  body: string | null,
  timestamp: number,
  secret: string
): Promise<string> {
  const bodyStr = body ?? '';
  const message = `${method}|${path}|${bodyStr}|${timestamp}`;

  return createHmacHexSignature(message, secret);
}

/**
 * Verify HMAC signature in request
 * Returns true if signature is valid and timestamp is recent (within 5 minutes)
 */
export async function verifyRequestSignature(
  method: string,
  path: string,
  body: string | null,
  timestamp: number,
  signature: string,
  secret: string,
  maxAgeSeconds = 300 // 5 minutes
): Promise<boolean> {
  // Check timestamp is recent
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAgeSeconds) {
    logger.warn(
      {
        timestamp,
        now,
        diff: Math.abs(now - timestamp),
        maxAge: maxAgeSeconds,
      },
      'Request timestamp outside acceptable window'
    );
    return false;
  }

  // Generate expected signature
  const expectedSignature = await generateRequestSignature(method, path, body, timestamp, secret);

  return expectedSignature.length === signature.length && expectedSignature === signature;
}

/**
 * Extract signature components from headers
 */
export function extractSignatureFromHeaders(headers: Record<string, string | undefined>) {
  const signature = headers['x-partygame-signature'];
  const timestamp = headers['x-partygame-timestamp'];
  const clientId = headers['x-partygame-client-id'];

  return { signature, timestamp: timestamp ? parseInt(timestamp, 10) : null, clientId };
}

/**
 * Middleware: Verify request signature
 * Requires X-PartyGame-Signature, X-PartyGame-Timestamp, and X-PartyGame-Client-Id headers
 */
export async function requestSigningMiddleware(
  c: Context,
  next: () => Promise<void>,
  clientSecrets: Map<string, string> // clientId -> secret mapping
) {
  // Skip signing verification for certain endpoints (health checks, openapi, etc.)
  const path = new URL(c.req.url).pathname;
  const publicEndpoints = ['/health', '/ready', '/openapi.json', '/metrics', '/sla'];
  if (publicEndpoints.includes(path)) {
    await next();
    return;
  }

  // Extract signature components
  const headers = Object.fromEntries(
    [...c.req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])
  );
  const { signature, timestamp, clientId } = extractSignatureFromHeaders(headers);

  if (!signature || !timestamp || !clientId) {
    logger.warn(
      { signature: !!signature, timestamp: !!timestamp, clientId: !!clientId },
      'Missing signature headers'
    );
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing required signature headers (X-PartyGame-Signature, X-PartyGame-Timestamp, X-PartyGame-Client-Id)',
      },
      401
    );
  }

  // Get client secret
  const secret = clientSecrets.get(clientId);
  if (!secret) {
    logger.warn({ clientId }, 'Unknown client ID');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Unknown client ID',
      },
      401
    );
  }

  // Read and buffer request body
  let bodyStr = '';
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    try {
      const bodyBuffer = await c.req.arrayBuffer();
      bodyStr = new TextDecoder().decode(bodyBuffer);

      // Store body in context for later handlers
      c.set('rawRequestBody', bodyStr);
    } catch (err) {
      logger.error({ error: err }, 'Failed to read request body');
      return c.json(
        {
          error: 'Bad Request',
          message: 'Failed to read request body',
        },
        400
      );
    }
  }

  // Verify signature
  const method = c.req.method;
  const pathStr = new URL(c.req.url).pathname;
  if (!(await verifyRequestSignature(method, pathStr, bodyStr || null, timestamp, signature, secret))) {
    logger.warn(
      { clientId, method, path: pathStr },
      'Invalid request signature'
    );
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid request signature',
      },
      401
    );
  }

  // Signature verified - attach client info to context
  c.set('clientId', clientId);
  c.set('requestBody', bodyStr);

  await next();
}

/**
 * Helper: Get client ID from verified request
 */
export function getClientId(c: Context): string | null {
  return c.get('clientId') as string | null;
}

/**
 * Helper: Get request body from context (for already-verified requests)
 */
export function getRequestBody(c: Context): string {
  return (c.get('requestBody') as string) ?? '';
}
