/**
 * JWT Session Management
 * Handles player authentication, token generation, and refresh logic
 * Replaces the existing basic auth with proper token-based security
 */

import { sign, verify } from 'jsonwebtoken';
import { Context } from 'hono';

export interface JWTPayload {
  playerId: string;
  playerName: string;
  email?: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Configuration for JWT signing
 * Should be set from environment variables
 */
let jwtSecret: string;
let jwtRefreshSecret: string;
let accessTokenExpiry = '15m';
let refreshTokenExpiry = '7d';

/**
 * Initialize JWT configuration from environment
 */
export function initializeJWT(config: {
  secret: string;
  refreshSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
}) {
  jwtSecret = config.secret;
  jwtRefreshSecret = config.refreshSecret;
  if (config.accessTokenExpiry) accessTokenExpiry = config.accessTokenExpiry;
  if (config.refreshTokenExpiry) refreshTokenExpiry = config.refreshTokenExpiry;
}

/**
 * Generate a new access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!jwtSecret) throw new Error('JWT not initialized');

  return sign(payload, jwtSecret, {
    expiresIn: accessTokenExpiry,
    algorithm: 'HS256',
  });
}

/**
 * Generate a new refresh token
 */
export function generateRefreshToken(playerId: string): string {
  if (!jwtRefreshSecret) throw new Error('JWT not initialized');

  return sign({ playerId }, jwtRefreshSecret, {
    expiresIn: refreshTokenExpiry,
    algorithm: 'HS256',
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload.playerId);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  if (!jwtSecret) throw new Error('JWT not initialized');

  try {
    return verify(token, jwtSecret, { algorithms: ['HS256'] }) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): { playerId: string } | null {
  if (!jwtRefreshSecret) throw new Error('JWT not initialized');

  try {
    return verify(token, jwtRefreshSecret, { algorithms: ['HS256'] }) as { playerId: string };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Middleware: Authenticate JWT token from Authorization header
 */
export async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      },
      401
    );
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      },
      401
    );
  }

  // Attach decoded token to context
  c.set('playerId', payload.playerId);
  c.set('playerName', payload.playerName);
  c.set('jwtPayload', payload);

  await next();
}

/**
 * Get player ID from authenticated request context
 */
export function getPlayerId(c: Context): string | null {
  return c.get('playerId') as string | null;
}

/**
 * Get JWT payload from authenticated request context
 */
export function getJWTPayload(c: Context): JWTPayload | null {
  return c.get('jwtPayload') as JWTPayload | null;
}
