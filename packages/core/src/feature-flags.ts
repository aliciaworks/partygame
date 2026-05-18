/**
 * Feature Flags & A/B Testing
 * Control feature rollout and enable gradual deployment
 */

import { Context } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDatabase } from './db';
import { featureFlags } from './schema-extended';
import { getLogger } from './logger';
import { nanoid } from 'nanoid';

const logger = getLogger();

export interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetPlayers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory cache for feature flags (refresh every 60 seconds)
 */
let flagCache: Map<string, FeatureFlag> = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 60 seconds

/**
 * Check if feature is enabled for a player
 */
export function isFeatureEnabled(
  flagName: string,
  playerId?: string,
  rolloutPercentage: number = 100,
  targetPlayers?: string[]
): boolean {
  // Check target players list
  if (targetPlayers && targetPlayers.length > 0) {
    if (!playerId || !targetPlayers.includes(playerId)) {
      return false;
    }
  }

  // Check rollout percentage
  if (rolloutPercentage < 100 && playerId) {
    // Use player ID hash for consistent rollout
    const hash = playerId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 100 < rolloutPercentage;
  }

  return rolloutPercentage > 0;
}

/**
 * Get or refresh feature flag cache
 */
async function updateFlagCache(): Promise<void> {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) {
    return; // Cache is fresh
  }

  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized for flag cache');
    return;
  }

  try {
    const allFlags = await db.query.featureFlags.findMany({
      where: undefined,
    });

    flagCache.clear();
    for (const flag of allFlags) {
      flagCache.set(flag.name, {
        id: flag.id,
        name: flag.name,
        description: flag.description ?? undefined,
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
        targetPlayers: flag.targetPlayers ? JSON.parse(flag.targetPlayers) : undefined,
        createdAt: new Date(flag.createdAt as any),
        updatedAt: new Date(flag.updatedAt as any),
      });
    }

    lastCacheUpdate = now;
    logger.debug({ count: flagCache.size }, 'Feature flag cache updated');
  } catch (err) {
    logger.error({ error: err }, 'Failed to update feature flag cache');
  }
}

/**
 * Check if feature is enabled (uses cache)
 */
export async function checkFeatureEnabled(
  flagName: string,
  playerId?: string
): Promise<boolean> {
  await updateFlagCache();

  const flag = flagCache.get(flagName);
  if (!flag) {
    logger.warn({ flagName }, 'Feature flag not found');
    return false;
  }

  if (!flag.enabled) {
    return false;
  }

  return isFeatureEnabled(flagName, playerId, flag.rolloutPercentage, flag.targetPlayers);
}

/**
 * Create or update feature flag
 */
export async function setFeatureFlag(
  name: string,
  enabled: boolean,
  rolloutPercentage: number = 100,
  targetPlayers?: string[],
  description?: string
): Promise<FeatureFlag | null> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return null;
  }

  try {
    const existing = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, name),
    });

    const flag = {
      name,
      enabled,
      rolloutPercentage: Math.min(100, Math.max(0, rolloutPercentage)),
      targetPlayers: targetPlayers ? JSON.stringify(targetPlayers) : null,
      description,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(featureFlags)
        .set(flag)
        .where(eq(featureFlags.id, existing.id));
    } else {
      await db.insert(featureFlags).values({
        id: nanoid(),
        ...flag,
        createdAt: new Date(),
      });
    }

    // Invalidate cache
    lastCacheUpdate = 0;

    logger.info(
      { name, enabled, rolloutPercentage },
      'Feature flag updated'
    );

    return await checkFeatureFlag(name);
  } catch (err) {
    logger.error({ error: err, name }, 'Failed to set feature flag');
    return null;
  }
}

/**
 * Get feature flag details
 */
export async function checkFeatureFlag(name: string): Promise<FeatureFlag | null> {
  const db = getDatabase();
  if (!db) return null;

  try {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, name),
    });

    if (!flag) return null;

    return {
      id: flag.id,
      name: flag.name,
      description: flag.description ?? undefined,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetPlayers: flag.targetPlayers ? JSON.parse(flag.targetPlayers) : undefined,
      createdAt: new Date(flag.createdAt as any),
      updatedAt: new Date(flag.updatedAt as any),
    };
  } catch (err) {
    logger.error({ error: err, name }, 'Failed to fetch feature flag');
    return null;
  }
}

/**
 * List all feature flags
 */
export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const flags = await db.query.featureFlags.findMany({
      orderBy: [desc(featureFlags.updatedAt)],
    });

    return flags.map((flag: any) => ({
      id: flag.id,
      name: flag.name,
      description: flag.description ?? undefined,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetPlayers: flag.targetPlayers ? JSON.parse(flag.targetPlayers) : undefined,
      createdAt: new Date(flag.createdAt as any),
      updatedAt: new Date(flag.updatedAt as any),
    }));
  } catch (err) {
    logger.error({ error: err }, 'Failed to list feature flags');
    return [];
  }
}

/**
 * HTTP Handler: Get feature flag status for player
 */
export async function handleCheckFeature(c: Context) {
  const flagName = c.req.param('flagName') || '';
  if (!flagName) {
    return c.json(
      { error: 'flagName is required' },
      400
    );
  }
  const playerId = c.req.query('playerId');

  const enabled = await checkFeatureEnabled(flagName, playerId || undefined);
  const flag = await checkFeatureFlag(flagName);

  return c.json({
    flag: flagName,
    enabled,
    rolloutPercentage: flag?.rolloutPercentage ?? 0,
    playerId,
  });
}

/**
 * HTTP Handler: List all flags
 */
export async function handleListFeatures(c: Context) {
  const flags = await listFeatureFlags();

  return c.json({
    count: flags.length,
    flags,
  });
}

/**
 * HTTP Handler: Update feature flag (admin only)
 */
export async function handleUpdateFeature(c: Context) {
  const flagName = c.req.param('flagName');

  try {
    const body = await c.req.json() as {
      enabled?: boolean;
      rolloutPercentage?: number;
      targetPlayers?: string[];
      description?: string;
    };

    const current = await checkFeatureFlag(flagName);
    const updated = await setFeatureFlag(
      flagName,
      body.enabled ?? current?.enabled ?? false,
      body.rolloutPercentage ?? current?.rolloutPercentage ?? 100,
      body.targetPlayers ?? current?.targetPlayers,
      body.description ?? current?.description
    );

    if (!updated) {
      return c.json(
        { error: 'Failed to update feature flag' },
        500
      );
    }

    return c.json(updated);
  } catch (err) {
    logger.error({ error: err, flagName }, 'Failed to update feature flag');
    return c.json(
      { error: 'Failed to update feature flag' },
      500
    );
  }
}
