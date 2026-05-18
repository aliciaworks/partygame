/**
 * Chat System
 * In-room and global chat with message history and moderation support
 */

import { Context } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from './db';
import { chatMessages } from './schema-extended';
import { getLogger } from './logger';
import { nanoid } from 'nanoid';

const logger = getLogger();

export interface ChatMessage {
  id: string;
  roomId?: string;
  playerId: string;
  playerName: string;
  message: string;
  type: 'message' | 'system_notification';
  createdAt: Date;
}

const BANNED_WORDS = new Set([
  'badword1',
  'badword2',
  // Add more as needed
]);

/**
 * Check if message contains inappropriate content
 */
function containsProfanity(message: string): boolean {
  const words = message.toLowerCase().split(/\s+/);
  return words.some((word) => BANNED_WORDS.has(word.replace(/[^a-z0-9]/g, '')));
}

/**
 * Filter/censor message content
 */
function censorMessage(message: string): string {
  let result = message;
  BANNED_WORDS.forEach((bannedWord) => {
    const regex = new RegExp(`\\b${bannedWord}\\b`, 'gi');
    result = result.replace(regex, '*'.repeat(bannedWord.length));
  });
  return result;
}

/**
 * Save chat message to database
 */
export async function saveChatMessage(
  playerId: string,
  playerName: string,
  message: string,
  roomId?: string
): Promise<ChatMessage | null> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return null;
  }

  try {
    // Validate message length
    if (message.length === 0 || message.length > 500) {
      logger.warn({ playerId, messageLength: message.length }, 'Invalid message length');
      return null;
    }

    // Check for profanity
    const censored = censorMessage(message);
    const hasProfanity = containsProfanity(message);

    if (hasProfanity) {
      logger.info({ playerId, roomId }, 'Message flagged for profanity');
    }

    const id = nanoid();
    const now = new Date();

    await db.insert(chatMessages).values({
      id,
      roomId,
      playerId,
      playerName,
      message: censored,
      type: 'message',
      createdAt: now,
    });

    return {
      id,
      roomId,
      playerId,
      playerName,
      message: censored,
      type: 'message',
      createdAt: now,
    };
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to save chat message');
    return null;
  }
}

/**
 * Get chat history for a room
 */
export async function getRoomChatHistory(
  roomId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const messages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.roomId, roomId),
      orderBy: [desc(chatMessages.createdAt)],
      limit,
    });

    return messages.reverse().map((msg: any) => ({
      id: msg.id,
      roomId: msg.roomId,
      playerId: msg.playerId,
      playerName: msg.playerName,
      message: msg.message,
      type: msg.type as 'message' | 'system_notification',
      createdAt: new Date(msg.createdAt as any),
    }));
  } catch (err) {
    logger.error({ error: err, roomId }, 'Failed to fetch chat history');
    return [];
  }
}

/**
 * Send system notification to room
 */
export async function sendSystemNotification(
  roomId: string,
  message: string
): Promise<void> {
  const db = getDatabase();
  if (!db) return;

  try {
    await db.insert(chatMessages).values({
      id: nanoid(),
      roomId,
      playerId: 'system',
      playerName: 'System',
      message,
      type: 'system_notification',
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error({ error: err, roomId }, 'Failed to send system notification');
  }
}

/**
 * HTTP Handler: Get room chat history
 */
export async function handleGetChatHistory(c: Context) {
  const roomId = c.req.param('roomId') || '';
  if (!roomId) {
    return c.json(
      { error: 'roomId is required' },
      400
    );
  }
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 200);

  const messages = await getRoomChatHistory(roomId, limit);

  return c.json({
    roomId,
    count: messages.length,
    messages,
  });
}

/**
 * HTTP Handler: Post chat message
 */
export async function handlePostChatMessage(c: Context) {
  const roomId = c.req.param('roomId');
  const playerId = c.get('playerId');
  const playerName = c.get('playerName');

  if (!playerId) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication required',
      },
      401
    );
  }

  try {
    const body = await c.req.json() as { message: string };

    if (!body.message) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Message is required',
        },
        400
      );
    }

    const savedMessage = await saveChatMessage(playerId, playerName, body.message, roomId);

    if (!savedMessage) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Failed to save message (invalid length or content)',
        },
        400
      );
    }

    return c.json(savedMessage, 201);
  } catch (err) {
    logger.error({ error: err, roomId, playerId }, 'Failed to post chat message');
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to post chat message',
      },
      500
    );
  }
}
