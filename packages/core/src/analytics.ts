/**
 * Analytics & Event Tracking
 * Tracks user behavior events for product insights and data-driven decisions
 */

import { Context } from 'hono';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getDatabase } from './db';
import { analyticsEvents } from './schema-extended';
import { getLogger } from './logger';
import { nanoid } from 'nanoid';

const logger = getLogger();

export type EventName =
  | 'game_started'
  | 'game_completed'
  | 'player_joined_room'
  | 'player_left_room'
  | 'item_purchased'
  | 'achievement_unlocked'
  | 'level_up'
  | 'api_request'
  | 'spectator_joined'
  | 'spectator_left'
  | 'custom';

export interface AnalyticsEvent {
  id: string;
  playerId?: string;
  eventName: EventName;
  eventData: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Track an analytics event
 */
export async function trackEvent(
  eventName: EventName,
  eventData: Record<string, unknown> = {},
  playerId?: string
): Promise<void> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return;
  }

  try {
    await db.insert(analyticsEvents).values({
      id: nanoid(),
      playerId,
      eventName,
      eventData: JSON.stringify(eventData),
      createdAt: new Date(),
    });

    logger.debug(
      { eventName, playerId, dataKeys: Object.keys(eventData) },
      'Analytics event tracked'
    );
  } catch (err) {
    logger.error({ error: err, eventName, playerId }, 'Failed to track event');
  }
}

/**
 * Middleware: Auto-track HTTP requests as analytics events
 */
export async function analyticsMiddleware(c: Context, next: () => Promise<void>) {
  const startTime = Date.now();
  const playerId = c.get('playerId') as string | undefined;

  try {
    await next();
  } finally {
    const duration = Date.now() - startTime;
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const status = c.res.status;

    // Track API calls
    if (method !== 'GET' || path.includes('/api')) {
      await trackEvent('api_request', {
        method,
        path,
        status,
        duration,
      }, playerId);
    }
  }
}

/**
 * Get event statistics for a time range
 */
export async function getEventStats(
  eventName: EventName,
  hoursAgo: number = 24
): Promise<{
  eventName: EventName;
  totalCount: number;
  uniquePlayers: number;
  avgPerPlayer: number;
}> {
  const db = getDatabase();
  if (!db) {
    return {
      eventName,
      totalCount: 0,
      uniquePlayers: 0,
      avgPerPlayer: 0,
    };
  }

  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const events = await db.query.analyticsEvents.findMany({
      where: and(
        eq(analyticsEvents.eventName, eventName),
        gte(analyticsEvents.createdAt, cutoffTime)
      ),
    });

    const uniquePlayersSet = new Set<string>();
    let totalCount = 0;

    for (const event of events) {
      totalCount++;
      if (event.playerId) {
        uniquePlayersSet.add(event.playerId);
      }
    }

    const uniquePlayers = uniquePlayersSet.size;
    const avgPerPlayer = uniquePlayers > 0 ? totalCount / uniquePlayers : 0;

    return {
      eventName,
      totalCount,
      uniquePlayers,
      avgPerPlayer,
    };
  } catch (err) {
    logger.error({ error: err, eventName }, 'Failed to compute event stats');
    return {
      eventName,
      totalCount: 0,
      uniquePlayers: 0,
      avgPerPlayer: 0,
    };
  }
}

/**
 * Get funnel analysis (sequence of events)
 */
export async function analyzeFunnel(
  eventSequence: EventName[],
  hoursAgo: number = 24
): Promise<{
  step: number;
  eventName: EventName;
  playerCount: number;
  dropoffRate: number;
}[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    // Get events
    const events = await db.query.analyticsEvents.findMany({
      where: gte(analyticsEvents.createdAt, cutoffTime),
      orderBy: [desc(analyticsEvents.createdAt)],
    });

    // Group by player
    const playerEvents = new Map<string, AnalyticsEvent[]>();
    for (const event of events) {
      if (!event.playerId) continue;

      if (!playerEvents.has(event.playerId)) {
        playerEvents.set(event.playerId, []);
      }
      playerEvents.get(event.playerId)!.push({
        id: event.id,
        playerId: event.playerId,
        eventName: event.eventName as EventName,
        eventData: JSON.parse(event.eventData ?? '{}') as Record<string, unknown>,
        timestamp: new Date(event.createdAt as any),
      });
    }

    // Analyze funnel
    const results = [];
    let prevStepPlayers = playerEvents.size;

    for (let i = 0; i < eventSequence.length; i++) {
      const eventName = eventSequence[i];
      let stepPlayers = 0;

      for (const playerEventList of playerEvents.values()) {
        if (playerEventList.some((e) => e.eventName === eventName)) {
          stepPlayers++;
        }
      }

      const dropoffRate = prevStepPlayers > 0 ? (prevStepPlayers - stepPlayers) / prevStepPlayers : 0;

      results.push({
        step: i + 1,
        eventName,
        playerCount: stepPlayers,
        dropoffRate,
      });

      prevStepPlayers = stepPlayers;
    }

    return results;
  } catch (err) {
    logger.error({ error: err }, 'Failed to analyze funnel');
    return [];
  }
}

/**
 * Get player's event history
 */
export async function getPlayerEventHistory(
  playerId: string,
  limit: number = 100,
  hoursAgo: number = 24
): Promise<AnalyticsEvent[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const events = await db.query.analyticsEvents.findMany({
      where: and(
        eq(analyticsEvents.playerId, playerId),
        gte(analyticsEvents.createdAt, cutoffTime)
      ),
      orderBy: [desc(analyticsEvents.createdAt)],
      limit,
    });

    return events.map((e: any) => ({
      id: e.id,
      playerId: e.playerId ?? undefined,
      eventName: e.eventName as EventName,
      eventData: JSON.parse(e.eventData ?? '{}') as Record<string, unknown>,
      timestamp: new Date(e.createdAt as any),
    }));
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to fetch player event history');
    return [];
  }
}

/**
 * HTTP Handler: Get event statistics
 */
export async function handleGetEventStats(c: Context) {
  const eventName = c.req.param('eventName') as EventName;
  const hours = parseInt(c.req.query('hours') ?? '24');

  const stats = await getEventStats(eventName, hours);

  return c.json(stats);
}

/**
 * HTTP Handler: Analyze funnel
 */
export async function handleAnalyzeFunnel(c: Context) {
  try {
    const body = await c.req.json() as {
      eventSequence: EventName[];
      hoursAgo?: number;
    };

    if (!Array.isArray(body.eventSequence) || body.eventSequence.length === 0) {
      return c.json(
        { error: 'eventSequence must be a non-empty array' },
        400
      );
    }

    const results = await analyzeFunnel(body.eventSequence, body.hoursAgo ?? 24);

    return c.json({
      funnel: body.eventSequence,
      steps: results,
    });
  } catch (err) {
    logger.error({ error: err }, 'Failed to analyze funnel');
    return c.json(
      { error: 'Failed to analyze funnel' },
      500
    );
  }
}

/**
 * HTTP Handler: Get player event history
 */
export async function handleGetPlayerEvents(c: Context) {
  const playerId = c.req.param('playerId') || '';
  if (!playerId) {
    return c.json(
      { error: 'playerId is required' },
      400
    );
  }
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 500);
  const hours = parseInt(c.req.query('hours') ?? '24');

  const events = await getPlayerEventHistory(playerId, limit, hours);

  return c.json({
    playerId,
    count: events.length,
    events,
  });
}

/**
 * Batch export events to data warehouse (simplified)
 */
export async function exportEventsToWarehouse(
  startTime: Date,
  endTime: Date
): Promise<number> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return 0;
  }

  try {
    const events = await db.query.analyticsEvents.findMany({
      where: and(
        gte(analyticsEvents.createdAt, startTime),
      ),
    });

    // In a real implementation, would batch export to BigQuery/Snowflake/etc
    logger.info(
      { count: events.length, startTime, endTime },
      'Events exported to warehouse'
    );

    return events.length;
  } catch (err) {
    logger.error({ error: err }, 'Failed to export events');
    return 0;
  }
}
