/**
 * Protocol Versioning & Compatibility
 * Manages API protocol versions to support rolling upgrades
 * Allows clients to declare compatible API versions
 */

import { Context } from 'hono';
import { getLogger } from './logger';

const logger = getLogger();

/**
 * Supported protocol versions
 * When adding new versions:
 * 1. Add to this constant
 * 2. Implement compatibility layer if response format changed
 * 3. Update CHANGELOG
 */
export const PROTOCOL_VERSIONS = {
  v1: {
    version: '1.0.0',
    releaseDate: '2026-01-01',
    deprecated: false,
    endpoints: ['auth/login', 'auth/refresh', 'room/join', 'room/move', 'inventory/purchase'],
  },
  v2: {
    version: '2.0.0',
    releaseDate: '2026-05-01',
    deprecated: false,
    breaking: ['inventory/purchase response includes receipt_id'],
    newEndpoints: ['leaderboard/top', 'achievements/list', 'chat/send'],
    removedEndpoints: [],
    endpoints: [
      'auth/login',
      'auth/refresh',
      'room/join',
      'room/move',
      'inventory/purchase',
      'leaderboard/top',
      'achievements/list',
      'chat/send',
    ],
  },
  v3: {
    version: '3.0.0',
    releaseDate: '2026-09-01',
    deprecated: false,
    breaking: ['auth uses JWT instead of session tokens'],
    newEndpoints: ['spectate/watch', 'replay/fetch', 'features/flags'],
    removedEndpoints: [],
    endpoints: [
      'auth/login',
      'auth/refresh',
      'room/join',
      'room/move',
      'inventory/purchase',
      'leaderboard/top',
      'achievements/list',
      'chat/send',
      'spectate/watch',
      'replay/fetch',
      'features/flags',
    ],
  },
} as const;

export type ProtocolVersion = keyof typeof PROTOCOL_VERSIONS;

/**
 * Get current recommended version
 */
export function getCurrentVersion(): ProtocolVersion {
  return 'v3';
}

/**
 * Get minimum supported version
 */
export function getMinimumVersion(): ProtocolVersion {
  return 'v1';
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: string): boolean {
  return version in PROTOCOL_VERSIONS;
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version: ProtocolVersion): boolean {
  return PROTOCOL_VERSIONS[version].deprecated;
}

/**
 * Get version info
 */
export function getVersionInfo(version: ProtocolVersion) {
  return PROTOCOL_VERSIONS[version];
}

/**
 * Extract protocol version from request
 * Priority: Header > Query param > Default to current
 */
export function extractVersionFromRequest(c: Context): ProtocolVersion {
  // Try X-API-Version header
  const headerVersion = c.req.header('X-API-Version');
  if (headerVersion && isVersionSupported(headerVersion)) {
    return headerVersion as ProtocolVersion;
  }

  // Try api_version query param
  const queryVersion = c.req.query('api_version');
  if (queryVersion && isVersionSupported(queryVersion)) {
    return queryVersion as ProtocolVersion;
  }

  // Try X-PartyGame-Version header
  const partyGameVersion = c.req.header('X-PartyGame-Version');
  if (partyGameVersion && isVersionSupported(partyGameVersion)) {
    return partyGameVersion as ProtocolVersion;
  }

  // Default to current version
  return getCurrentVersion();
}

/**
 * Middleware: Protocol version negotiation
 * Attaches version info to context for downstream handlers
 */
export async function versionNegotiationMiddleware(c: Context, next: () => Promise<void>) {
  const version = extractVersionFromRequest(c);

  // Warn if deprecated version
  if (isVersionDeprecated(version)) {
    logger.warn(
      { version, currentVersion: getCurrentVersion() },
      'Client using deprecated protocol version'
    );

    // Add deprecation warning header
    c.header('X-API-Version-Deprecated', 'true');
    c.header(
      'X-API-Version-Sunset',
      `Please upgrade to ${getCurrentVersion()}`
    );
  }

  // Attach version to context
  c.set('apiVersion', version);
  c.set('versionInfo', getVersionInfo(version));

  // Add version to response headers
  c.header('X-API-Version', version);

  await next();
}

/**
 * Get API version from request context
 */
export function getApiVersion(c: Context): ProtocolVersion {
  return c.get('apiVersion') as ProtocolVersion || getCurrentVersion();
}

/**
 * Get full version info from context
 */
export function getApiVersionInfo(c: Context) {
  return c.get('versionInfo');
}

/**
 * Response wrapper for version-aware API responses
 */
export function sendVersionedResponse(
  c: Context,
  statusCode: number,
  data: Record<string, unknown>
) {
  const version = getApiVersion(c);

  return c.json(
    {
      apiVersion: version,
      timestamp: new Date().toISOString(),
      data,
    },
    statusCode as any
  );
}

/**
 * Get compatibility notes for version
 */
export function getCompatibilityNotes(fromVersion: ProtocolVersion, toVersion: ProtocolVersion) {
  const fromIdx = Object.keys(PROTOCOL_VERSIONS).indexOf(fromVersion);
  const toIdx = Object.keys(PROTOCOL_VERSIONS).indexOf(toVersion);

  if (fromIdx === -1 || toIdx === -1) {
    return [];
  }

  const notes: string[] = [];

  if (toIdx > fromIdx) {
    // Upgrading
    const versionKeys = Object.keys(PROTOCOL_VERSIONS) as ProtocolVersion[];
    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const v = versionKeys[i];
      const vInfo = PROTOCOL_VERSIONS[v];
      const breaking = (vInfo as any).breaking;
      const newEndpoints = (vInfo as any).newEndpoints;
      const removedEndpoints = (vInfo as any).removedEndpoints;
      if (breaking) {
        notes.push(`Breaking changes in ${v}: ${breaking.join(', ')}`);
      }
      if (newEndpoints) {
        notes.push(`New endpoints in ${v}: ${newEndpoints.join(', ')}`);
      }
      if (removedEndpoints && removedEndpoints.length > 0) {
        notes.push(`Removed endpoints in ${v}: ${removedEndpoints.join(', ')}`);
      }
    }
  }

  return notes;
}

/**
 * Handler for /api-versions endpoint to list all versions
 */
export function handleVersionsEndpoint(c: Context) {
  const current = getCurrentVersion();
  const minimum = getMinimumVersion();

  return c.json({
    current,
    minimum,
    versions: Object.fromEntries(
      Object.entries(PROTOCOL_VERSIONS).map(([key, value]) => [
        key,
        {
          version: value.version,
          releaseDate: value.releaseDate,
          deprecated: value.deprecated,
          endpoints: value.endpoints.length,
        },
      ])
    ),
  });
}
