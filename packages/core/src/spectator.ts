/**
 * Spectator System
 * Allows players to watch ongoing games in real-time
 * Enables live streaming and tournament viewing
 */

import { Context } from 'hono';
import { getLogger } from './logger';
import { trackEvent } from './analytics';

const logger = getLogger();

export interface SpectatorSession {
  id: string;
  roomId: string;
  spectatorId: string;
  spectatorName: string;
  joinedAt: Date;
  updatedAt: Date;
}

/**
 * In-memory spectator session storage
 * In production, use Durable Objects or KV store
 */
const activeSessions = new Map<string, SpectatorSession>();

/**
 * Join a room as spectator
 */
export async function joinAsSpectator(
  roomId: string,
  spectatorId: string,
  spectatorName: string
): Promise<SpectatorSession | null> {
  try {
    const sessionId = `spec-${roomId}-${spectatorId}-${Date.now()}`;
    const now = new Date();

    const session: SpectatorSession = {
      id: sessionId,
      roomId,
      spectatorId,
      spectatorName,
      joinedAt: now,
      updatedAt: now,
    };

    activeSessions.set(sessionId, session);

    logger.info(
      { sessionId, roomId, spectatorId },
      'Spectator joined room'
    );

    await trackEvent('spectator_joined', {
      roomId,
      spectatorName,
    }, spectatorId);

    return session;
  } catch (err) {
    logger.error({ error: err, roomId, spectatorId }, 'Failed to join as spectator');
    return null;
  }
}

/**
 * Leave spectator session
 */
export async function leaveAsSpectator(sessionId: string): Promise<void> {
  try {
    const session = activeSessions.get(sessionId);
    if (session) {
      activeSessions.delete(sessionId);

      logger.info(
        { sessionId, roomId: session.roomId },
        'Spectator left room'
      );

      await trackEvent('spectator_left', {
        roomId: session.roomId,
        duration: Date.now() - session.joinedAt.getTime(),
      }, session.spectatorId);
    }
  } catch (err) {
    logger.error({ error: err, sessionId }, 'Failed to leave as spectator');
  }
}

/**
 * Get active spectators for a room
 */
export async function getRoomSpectators(roomId: string): Promise<SpectatorSession[]> {
  const spectators: SpectatorSession[] = [];

  for (const session of activeSessions.values()) {
    if (session.roomId === roomId) {
      spectators.push(session);
    }
  }

  return spectators;
}

/**
 * Get spectator count for a room
 */
export async function getSpectatorCount(roomId: string): Promise<number> {
  let count = 0;

  for (const session of activeSessions.values()) {
    if (session.roomId === roomId) {
      count++;
    }
  }

  return count;
}

/**
 * Broadcast game state to spectators
 * Called by game tick handler
 */
export async function broadcastGameStateToSpectators(
  roomId: string,
  gameState: Record<string, unknown>
): Promise<void> {
  const spectators = await getRoomSpectators(roomId);

  if (spectators.length === 0) {
    return;
  }

  // In a real implementation, would use WebSocket or Server-Sent Events
  // For now, just log
  logger.debug(
    { roomId, spectatorCount: spectators.length },
    'Broadcasting game state to spectators'
  );

  // Example: Send to WebSocket server or Cloudflare Workers Streams
  // await spectatorBroadcaster.send(roomId, gameState);
}

/**
 * HTTP Handler: Join spectator mode
 */
export async function handleJoinSpectator(c: Context) {
  const roomId = c.req.param('roomId') || '';
  if (!roomId) {
    return c.json(
      { error: 'roomId is required' },
      400
    );
  }
  const spectatorId = c.get('playerId') as string | null;
  const spectatorName = c.get('playerName') as string | null;

  if (!spectatorId || !spectatorName) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  const session = await joinAsSpectator(roomId, spectatorId || '', spectatorName || '');

  if (!session) {
    return c.json(
      {
        error: 'Bad Request',
        message: 'Failed to join as spectator',
      },
      400
    );
  }

  return c.json(session, 201);
}

/**
 * HTTP Handler: Leave spectator mode
 */
export async function handleLeaveSpectator(c: Context) {
  const sessionId = c.req.param('sessionId') || '';

  await leaveAsSpectator(sessionId);

  return c.json({ success: true });
}

/**
 * HTTP Handler: Get room spectators
 */
export async function handleGetRoomSpectators(c: Context) {
  const roomId = c.req.param('roomId') || '';

  const spectators = await getRoomSpectators(roomId);
  const count = spectators.length;

  return c.json({
    roomId,
    spectatorCount: count,
    spectators: spectators.map((s) => ({
      id: s.spectatorId,
      name: s.spectatorName,
      joinedAt: s.joinedAt,
    })),
  });
}

/**
 * HTTP Handler: Get spectator count
 */
export async function handleGetSpectatorCount(c: Context) {
  const roomId = c.req.param('roomId') || '';

  const count = await getSpectatorCount(roomId);

  return c.json({
    roomId,
    spectatorCount: count,
  });
}

/**
 * WebSocket handler for spectator connections
 * This would be implemented with actual WebSocket support
 */
export async function handleSpectatorWebSocket(c: Context) {
  const roomId = c.req.param('roomId');
  const spectatorId = c.get('playerId') as string | null;

  if (!spectatorId) {
    return c.json(
      { error: 'Unauthorized' },
      401
    );
  }

  // In a real implementation, would upgrade to WebSocket and maintain connection
  // For now, return SSE (Server-Sent Events) endpoint info
  return c.json({
    message: 'Connect to /spectate/rooms/:roomId/stream for real-time updates',
    roomId,
    spectatorId,
  });
}

/**
 * Cleanup old spectator sessions (runs periodically)
 */
export async function cleanupStaleSpectators(maxAgeMinutes: number = 30): Promise<number> {
  let cleaned = 0;
  const cutoffTime = Date.now() - maxAgeMinutes * 60 * 1000;

  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.updatedAt.getTime() < cutoffTime) {
      activeSessions.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info({ cleaned, maxAgeMinutes }, 'Cleaned up stale spectator sessions');
  }

  return cleaned;
}
