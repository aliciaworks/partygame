/**
 * Achievement System
 * Tracks player achievements, unlocks, and progress
 * Supports unlocking on specific conditions and progress-based achievements
 */

import { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDatabase } from './db';
import { achievements, playerAchievements, players } from './schema-extended';
import { getLogger } from './logger';

const logger = getLogger();

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  points: number;
  rarity: string;
  requirement: AchievementRequirement;
}

export interface AchievementRequirement {
  type: 'score' | 'wins' | 'games' | 'social' | 'custom';
  target: number;
  [key: string]: unknown;
}

export interface PlayerAchievement {
  id: string;
  achievement: Achievement;
  unlockedAt: Date;
  progress: number;
}

/**
 * Core achievement definitions
 * Add more achievements by extending this object
 */
const CORE_ACHIEVEMENTS: Record<string, Achievement> = {
  first_win: {
    id: 'first_win',
    name: 'First Victory',
    description: 'Win your first game',
    category: 'gameplay',
    points: 10,
    rarity: 'common',
    requirement: { type: 'wins', target: 1 },
  },
  win_10_games: {
    id: 'win_10_games',
    name: 'Victory Chaser',
    description: 'Win 10 games',
    category: 'gameplay',
    points: 25,
    rarity: 'common',
    requirement: { type: 'wins', target: 10 },
  },
  score_1000: {
    id: 'score_1000',
    name: 'High Scorer',
    description: 'Achieve 1000 points in a single game',
    category: 'gameplay',
    points: 50,
    rarity: 'rare',
    requirement: { type: 'score', target: 1000 },
  },
  play_50_games: {
    id: 'play_50_games',
    name: 'Dedicated Player',
    description: 'Play 50 games',
    category: 'progression',
    points: 30,
    rarity: 'common',
    requirement: { type: 'games', target: 50 },
  },
  level_10: {
    id: 'level_10',
    name: 'Level Master',
    description: 'Reach level 10',
    category: 'progression',
    points: 75,
    rarity: 'epic',
    requirement: { type: 'custom', target: 10 },
  },
};

/**
 * Initialize achievements in database
 */
export async function initializeAchievements(): Promise<void> {
  const db = getDatabase();
  if (!db) return;

  try {
    for (const achievement of Object.values(CORE_ACHIEVEMENTS)) {
      // Check if achievement already exists
      const existing = await db.query.achievements.findFirst({
        where: eq(achievements.id, achievement.id),
      });

      if (!existing) {
        await db.insert(achievements).values({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          points: achievement.points,
          rarity: achievement.rarity,
          requirement: JSON.stringify(achievement.requirement),
        });

        logger.info({ id: achievement.id }, 'Achievement initialized');
      }
    }
  } catch (err) {
    logger.error({ error: err }, 'Failed to initialize achievements');
  }
}

/**
 * Get achievement definition
 */
export function getAchievementDefinition(id: string): Achievement | undefined {
  return CORE_ACHIEVEMENTS[id];
}

/**
 * Check if player has unlocked achievement
 */
export async function hasAchievement(playerId: string, achievementId: string): Promise<boolean> {
  const db = getDatabase();
  if (!db) return false;

  try {
    const result = await db.query.playerAchievements.findFirst({
      where: and(
        eq(playerAchievements.playerId, playerId),
        eq(playerAchievements.achievementId, achievementId)
      ),
    });

    return !!result;
  } catch (err) {
    logger.error({ error: err, playerId, achievementId }, 'Failed to check achievement');
    return false;
  }
}

/**
 * Unlock achievement for player
 */
export async function unlockAchievement(playerId: string, achievementId: string): Promise<void> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return;
  }

  try {
    // Check if already unlocked
    const existing = await hasAchievement(playerId, achievementId);
    if (existing) {
      return;
    }

    // Get achievement definition
    const achievement = getAchievementDefinition(achievementId);
    if (!achievement) {
      logger.warn({ achievementId }, 'Achievement definition not found');
      return;
    }

    // Create player achievement entry
    await db.insert(playerAchievements).values({
      id: `${playerId}-${achievementId}`,
      playerId,
      achievementId,
      unlockedAt: new Date(),
    });

    // Update player's achievement points
    const playerData = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (playerData) {
      await db
        .update(players)
        .set({
          experience: (playerData.experience || 0) + achievement.points,
        })
        .where(eq(players.id, playerId));
    }

    logger.info(
      { playerId, achievementId, points: achievement.points },
      'Achievement unlocked'
    );
  } catch (err) {
    logger.error({ error: err, playerId, achievementId }, 'Failed to unlock achievement');
  }
}

/**
 * Check and auto-unlock achievements based on player stats
 */
export async function checkAndUnlockAchievements(playerId: string): Promise<string[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const playerData = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!playerData) return [];

    const unlockedIds: string[] = [];

    // Check each achievement condition
    for (const [id, def] of Object.entries(CORE_ACHIEVEMENTS)) {
      const alreadyUnlocked = await hasAchievement(playerId, id);
      if (alreadyUnlocked) continue;

      let shouldUnlock = false;

      switch (def.requirement.type) {
        case 'wins':
          shouldUnlock = playerData.totalWins >= def.requirement.target;
          break;
        case 'games':
          shouldUnlock = playerData.totalGamesPlayed >= def.requirement.target;
          break;
        case 'custom':
          shouldUnlock = playerData.level >= def.requirement.target;
          break;
      }

      if (shouldUnlock) {
        await unlockAchievement(playerId, id);
        unlockedIds.push(id);
      }
    }

    return unlockedIds;
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to check achievements');
    return [];
  }
}

/**
 * Get all achievements for a player
 */
export async function getPlayerAchievements(playerId: string): Promise<PlayerAchievement[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const userAchievements = await db.query.playerAchievements.findMany({
      where: eq(playerAchievements.playerId, playerId),
    });

    return userAchievements.map((pa: any) => {
      const def = getAchievementDefinition(pa.achievementId);
      return {
        id: pa.id,
        achievement: def || {
          id: pa.achievementId,
          name: 'Unknown',
          description: '',
          category: 'other',
          points: 0,
          rarity: 'common',
          requirement: { type: 'custom', target: 0 },
        },
        unlockedAt: new Date(pa.unlockedAt as any),
        progress: pa.progress,
      };
    });
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to fetch player achievements');
    return [];
  }
}

/**
 * Get achievement statistics
 */
export async function getAchievementStats(playerId: string): Promise<{
  totalUnlocked: number;
  totalPoints: number;
  completionPercentage: number;
}> {
  const db = getDatabase();
  if (!db) return { totalUnlocked: 0, totalPoints: 0, completionPercentage: 0 };

  try {
    const playerAchievs = await getPlayerAchievements(playerId);
    const totalPoints = playerAchievs.reduce((sum, pa) => sum + pa.achievement.points, 0);
    const totalPossible = Object.values(CORE_ACHIEVEMENTS).reduce((sum, a) => sum + a.points, 0);

    return {
      totalUnlocked: playerAchievs.length,
      totalPoints,
      completionPercentage:
        totalPossible > 0 ? Math.round((totalPoints / totalPossible) * 100) : 0,
    };
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to compute achievement stats');
    return { totalUnlocked: 0, totalPoints: 0, completionPercentage: 0 };
  }
}

/**
 * HTTP Handler: Get all achievements
 */
export async function handleListAchievements(c: Context) {
  const achievements_list = Object.values(CORE_ACHIEVEMENTS);

  return c.json({
    count: achievements_list.length,
    achievements: achievements_list,
  });
}

/**
 * HTTP Handler: Get player's achievements
 */
export async function handleGetPlayerAchievements(c: Context) {
  const playerId = c.req.param('playerId') || '';
  if (!playerId) {
    return c.json(
      {
        error: 'Bad Request',
        message: 'playerId is required',
      },
      400
    );
  }

  const playerAchievs = await getPlayerAchievements(playerId);
  const stats = await getAchievementStats(playerId);

  return c.json({
    playerId,
    stats,
    achievements: playerAchievs,
  });
}
