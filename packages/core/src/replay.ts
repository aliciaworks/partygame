/**
 * Replay System
 * Records and stores game replays for analysis, anti-cheat, and entertainment
 */

import { Context } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { getDatabase } from './db';
import { replaySessions, roomSnapshots } from './schema-extended';
import { getLogger } from './logger';
import { nanoid } from 'nanoid';

const logger = getLogger();

export interface ReplayMetadata {
  id: string;
  roomId: string;
  duration: number; // seconds
  tickCount: number;
  dataUrl?: string;
  fileSize?: number;
  createdAt: Date;
}

export interface TickSnapshot {
  tick: number;
  state: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Start recording a new replay session
 */
export async function startReplaySession(roomId: string): Promise<string> {
  const replayId = nanoid();
  logger.info({ roomId, replayId }, 'Replay session started');
  return replayId;
}

/**
 * Record a tick snapshot for replay
 */
export async function recordTickSnapshot(
  roomId: string,
  tickNumber: number,
  state: Record<string, unknown>
): Promise<void> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return;
  }

  try {
    const stateStr = JSON.stringify(state);
    const dataSize = Buffer.byteLength(stateStr, 'utf-8');

    // Store every 10th tick to reduce storage (or make configurable)
    if (tickNumber % 10 === 0) {
      await db.insert(roomSnapshots).values({
        id: `${roomId}-${tickNumber}`,
        roomId,
        tickNumber,
        state: stateStr,
        dataSize,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    logger.error({ error: err, roomId, tickNumber }, 'Failed to record tick snapshot');
  }
}

/**
 * End replay session and finalize storage
 */
export async function endReplaySession(
  replayId: string,
  roomId: string,
  tickCount: number
): Promise<ReplayMetadata | null> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return null;
  }

  try {
    // Get all snapshots for this replay
    const snapshots = await db.query.roomSnapshots.findMany({
      where: eq(roomSnapshots.roomId, roomId),
    });

    // Calculate duration (assuming 60 ticks per second)
    const duration = Math.ceil(tickCount / 60);

    // Calculate total file size
    const fileSize = snapshots.reduce((sum, s) => sum + (s.dataSize ?? 0), 0);

    // Store replay metadata
    await db.insert(replaySessions).values({
      id: replayId,
      roomId,
      duration,
      tickCount,
      fileSize,
      dataUrl: `replay://${replayId}`, // Placeholder for actual storage
      createdAt: new Date(),
    });

    logger.info(
      { replayId, roomId, duration, tickCount, fileSize },
      'Replay session ended and stored'
    );

    return {
      id: replayId,
      roomId,
      duration,
      tickCount,
      fileSize,
      createdAt: new Date(),
    };
  } catch (err) {
    logger.error(
      { error: err, replayId, roomId },
      'Failed to finalize replay session'
    );
    return null;
  }
}

/**
 * Get replay metadata
 */
export async function getReplayMetadata(replayId: string): Promise<ReplayMetadata | null> {
  const db = getDatabase();
  if (!db) return null;

  try {
    const replay = await db.query.replaySessions.findFirst({
      where: eq(replaySessions.id, replayId),
    });

    if (!replay) return null;

    return {
      id: replay.id,
      roomId: replay.roomId,
      duration: replay.duration,
      tickCount: replay.tickCount,
      dataUrl: replay.dataUrl ?? undefined,
      fileSize: replay.fileSize ?? undefined,
      createdAt: new Date(replay.createdAt as any),
    };
  } catch (err) {
    logger.error({ error: err, replayId }, 'Failed to fetch replay metadata');
    return null;
  }
}

/**
 * Get tick snapshot from replay
 */
export async function getTickSnapshot(
  roomId: string,
  tickNumber: number
): Promise<TickSnapshot | null> {
  const db = getDatabase();
  if (!db) return null;

  try {
    const snapshot = await db.query.roomSnapshots.findFirst({
      where: eq(roomSnapshots.roomId, roomId),
    });

    if (!snapshot) return null;

    return {
      tick: snapshot.tickNumber,
      state: JSON.parse(snapshot.state) as Record<string, unknown>,
      timestamp: new Date(snapshot.createdAt as any),
    };
  } catch (err) {
    logger.error(
      { error: err, roomId, tickNumber },
      'Failed to fetch tick snapshot'
    );
    return null;
  }
}

/**
 * Reconstruct game state at a specific tick
 * Works by finding nearest stored snapshot and replaying from there
 */
export async function reconstructGameState(
  roomId: string,
  targetTick: number
): Promise<Record<string, unknown> | null> {
  const db = getDatabase();
  if (!db) return null;

  try {
    // Find nearest snapshot at or before target tick
    const snapshots = await db.query.roomSnapshots.findMany({
      where: eq(roomSnapshots.roomId, roomId),
    });

    const nearestSnapshot = snapshots
      .filter((s) => s.tickNumber <= targetTick)
      .sort((a, b) => b.tickNumber - a.tickNumber)[0];

    if (!nearestSnapshot) {
      return null;
    }

    const baseState = JSON.parse(nearestSnapshot.state) as Record<string, unknown>;

    // In a full implementation, we'd replay forward from this snapshot
    // For now, just return the snapshot state
    return baseState;
  } catch (err) {
    logger.error(
      { error: err, roomId, targetTick },
      'Failed to reconstruct game state'
    );
    return null;
  }
}

/**
 * List replays for a room
 */
export async function listRoomReplays(
  roomId: string,
  limit: number = 20
): Promise<ReplayMetadata[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const replays = await db.query.replaySessions.findMany({
      where: eq(replaySessions.roomId, roomId),
      orderBy: [desc(replaySessions.createdAt)],
      limit,
    });

    return replays.map((replay) => ({
      id: replay.id,
      roomId: replay.roomId,
      duration: replay.duration,
      tickCount: replay.tickCount,
      dataUrl: replay.dataUrl ?? undefined,
      fileSize: replay.fileSize ?? undefined,
      createdAt: new Date(replay.createdAt as any),
    }));
  } catch (err) {
    logger.error({ error: err, roomId }, 'Failed to list room replays');
    return [];
  }
}

/**
 * Delete old replays to save storage
 */
export async function deleteOldReplays(ageInDays: number = 30): Promise<number> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return 0;
  }

  try {
    const cutoffDate = new Date(Date.now() - ageInDays * 24 * 60 * 60 * 1000);

    // This is a simplified example - actual deletion would depend on Drizzle API
    logger.info({ ageInDays, cutoffDate }, 'Cleanup old replays started');

    return 0; // Placeholder
  } catch (err) {
    logger.error({ error: err, ageInDays }, 'Failed to delete old replays');
    return 0;
  }
}

/**
 * HTTP Handler: Get replay metadata
 */
export async function handleGetReplay(c: Context) {
  const replayId = c.req.param('replayId');

  const metadata = await getReplayMetadata(replayId);

  if (!metadata) {
    return c.json(
      {
        error: 'Not Found',
        message: `Replay ${replayId} not found`,
      },
      404
    );
  }

  return c.json(metadata);
}

/**
 * HTTP Handler: List room replays
 */
export async function handleListRoomReplays(c: Context) {
  const roomId = c.req.param('roomId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);

  const replays = await listRoomReplays(roomId, limit);

  return c.json({
    roomId,
    count: replays.length,
    replays,
  });
}

/**
 * HTTP Handler: Get tick snapshot
 */
export async function handleGetTickSnapshot(c: Context) {
  const replayId = c.req.param('replayId');
  const tick = parseInt(c.req.param('tick'));

  // Find room ID from replay metadata
  const metadata = await getReplayMetadata(replayId);
  if (!metadata) {
    return c.json(
      { error: 'Replay not found' },
      404
    );
  }

  const snapshot = await getTickSnapshot(metadata.roomId, tick);
  if (!snapshot) {
    return c.json(
      { error: 'Snapshot not found' },
      404
    );
  }

  return c.json(snapshot);
}
