/**
 * JWT Session Management
 * Handles player authentication, token generation, and refresh logic
 * Uses Web Crypto so the worker can run without nodejs_compat.
 */

import { Context } from 'hono';
import { signJwt, verifyJwt } from './crypto-utils';

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
export async function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  if (!jwtSecret) throw new Error('JWT not initialized');

  return signJwt(payload, jwtSecret, accessTokenExpiry);
}

/**
 * Generate a new refresh token
 */
export async function generateRefreshToken(playerId: string): Promise<string> {
  if (!jwtRefreshSecret) throw new Error('JWT not initialized');

  return signJwt({ playerId }, jwtRefreshSecret, refreshTokenExpiry);
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<TokenPair> {
  const accessToken = await generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(payload.playerId);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode access token
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  if (!jwtSecret) throw new Error('JWT not initialized');

  try {
    return await verifyJwt<JWTPayload>(token, jwtSecret);
  } catch {
    return null;
  }
}

/**
 * Verify and decode refresh token
 */
export async function verifyRefreshToken(token: string): Promise<{ playerId: string } | null> {
  if (!jwtRefreshSecret) throw new Error('JWT not initialized');

  try {
    return await verifyJwt<{ playerId: string }>(token, jwtRefreshSecret);
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

  const payload = await verifyAccessToken(token);
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
