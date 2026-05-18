/**
 * Leaderboard System
 * Global rankings with seasonal support and tier classification
 * Integrates with metrics system for real-time updates
 */

import { Context } from 'hono';
import { eq, desc, and, gte } from 'drizzle-orm';
import { getDatabase } from './db';
import { leaderboardEntries, players } from './schema-extended';
import { getLogger } from './logger';

const logger = getLogger();

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  tier: string;
  level: number;
  wins: number;
}

export interface LeaderboardStats {
  playerRank: number;
  playerTier: string;
  rankChange: number; // +/- from last check
  score: number;
  topPlayers: LeaderboardEntry[];
}

/**
 * Tier classification based on rank
 */
function getTierFromRank(rank: number): string {
  if (rank <= 10) return 'diamond';
  if (rank <= 50) return 'platinum';
  if (rank <= 200) return 'gold';
  if (rank <= 1000) return 'silver';
  return 'bronze';
}

/**
 * Update a player's leaderboard entry
 */
export async function updatePlayerLeaderboardEntry(
  playerId: string,
  score: number,
  season: number = 1
): Promise<void> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return;
  }

  try {
    // Get current player info
    const playerData = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!playerData) {
      logger.warn({ playerId }, 'Player not found for leaderboard update');
      return;
    }

    // Find current rank (count players with higher scores)
    const result = await db.execute(
      `SELECT COUNT(*) as rank FROM ${leaderboardEntries._.name} WHERE score > ? AND season = ?`,
      [score, season]
    );
    const newRank = (result[0] as Record<string, unknown>)['rank'] as number + 1;

    const tier = getTierFromRank(newRank);

    // Upsert leaderboard entry
    await db
      .insert(leaderboardEntries)
      .values({
        id: `${playerId}-s${season}`,
        playerId,
        playerName: playerData.name,
        score,
        rank: newRank,
        season,
        tier,
      })
      .onConflictDoUpdate({
        target: [leaderboardEntries.id],
        set: {
          score,
          rank: newRank,
          tier,
          lastUpdatedAt: new Date(),
        },
      });

    logger.info(
      { playerId, score, rank: newRank, tier, season },
      'Leaderboard entry updated'
    );
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to update leaderboard entry');
  }
}

/**
 * Get top players by score
 */
export async function getTopPlayers(
  limit: number = 100,
  season: number = 1
): Promise<LeaderboardEntry[]> {
  const db = getDatabase();
  if (!db) return [];

  try {
    const entries = await db.query.leaderboardEntries.findMany({
      where: and(
        eq(leaderboardEntries.season, season),
      ),
      orderBy: [desc(leaderboardEntries.score)],
      limit,
    });

    return entries.map((entry, index) => ({
      rank: index + 1,
      playerId: entry.playerId,
      playerName: entry.playerName,
      score: entry.score,
      tier: entry.tier,
      level: 1, // TODO: fetch from players table
      wins: 0, // TODO: fetch from players table
    }));
  } catch (err) {
    logger.error({ error: err }, 'Failed to fetch top players');
    return [];
  }
}

/**
 * Get player's current rank and surrounding players
 */
export async function getPlayerRankContext(
  playerId: string,
  contextRange: number = 5,
  season: number = 1
): Promise<LeaderboardEntry[] | null> {
  const db = getDatabase();
  if (!db) return null;

  try {
    const playerEntry = await db.query.leaderboardEntries.findFirst({
      where: and(
        eq(leaderboardEntries.playerId, playerId),
        eq(leaderboardEntries.season, season)
      ),
    });

    if (!playerEntry) return null;

    const startRank = Math.max(1, playerEntry.rank - contextRange);
    const endRank = playerEntry.rank + contextRange;

    const entries = await db.query.leaderboardEntries.findMany({
      where: and(
        eq(leaderboardEntries.season, season),
        gte(leaderboardEntries.rank, startRank)
      ),
      orderBy: [desc(leaderboardEntries.score)],
      limit: contextRange * 2 + 1,
    });

    return entries.map((entry, index) => ({
      rank: startRank + index,
      playerId: entry.playerId,
      playerName: entry.playerName,
      score: entry.score,
      tier: entry.tier,
      level: 1,
      wins: 0,
    }));
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to fetch rank context');
    return null;
  }
}

/**
 * Get player's leaderboard stats
 */
export async function getPlayerLeaderboardStats(
  playerId: string,
  season: number = 1
): Promise<LeaderboardStats | null> {
  const db = getDatabase();
  if (!db) return null;

  try {
    const playerEntry = await db.query.leaderboardEntries.findFirst({
      where: and(
        eq(leaderboardEntries.playerId, playerId),
        eq(leaderboardEntries.season, season)
      ),
    });

    if (!playerEntry) return null;

    const topPlayers = await getTopPlayers(10, season);

    return {
      playerRank: playerEntry.rank,
      playerTier: playerEntry.tier,
      rankChange: 0, // TODO: track previous rank
      score: playerEntry.score,
      topPlayers,
    };
  } catch (err) {
    logger.error({ error: err, playerId }, 'Failed to fetch leaderboard stats');
    return null;
  }
}

/**
 * HTTP Handler: Get global leaderboard
 */
export async function handleGetLeaderboard(c: Context) {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 500);
  const season = parseInt(c.req.query('season') ?? '1');

  const topPlayers = await getTopPlayers(limit, season);

  return c.json({
    season,
    count: topPlayers.length,
    entries: topPlayers,
  });
}

/**
 * HTTP Handler: Get player's rank context
 */
export async function handleGetPlayerRank(c: Context) {
  const playerId = c.req.param('playerId');
  const season = parseInt(c.req.query('season') ?? '1');
  const range = parseInt(c.req.query('range') ?? '5');

  const context = await getPlayerRankContext(playerId, range, season);

  if (!context) {
    return c.json(
      {
        error: 'Not Found',
        message: `Player ${playerId} not found in leaderboard`,
      },
      404
    );
  }

  return c.json({
    season,
    playerContext: context,
  });
}

/**
 * HTTP Handler: Get player's leaderboard stats
 */
export async function handleGetPlayerStats(c: Context) {
  const playerId = c.req.param('playerId');
  const season = parseInt(c.req.query('season') ?? '1');

  const stats = await getPlayerLeaderboardStats(playerId, season);

  if (!stats) {
    return c.json(
      {
        error: 'Not Found',
        message: `Player ${playerId} not found in leaderboard`,
      },
      404
    );
  }

  return c.json(stats);
}

/**
 * Recalculate all ranks for a season (batch operation)
 * Call after score updates or season transition
 */
export async function recalculateLeaderboardRanks(season: number = 1): Promise<void> {
  const db = getDatabase();
  if (!db) {
    logger.warn({}, 'Database not initialized');
    return;
  }

  try {
    logger.info({ season }, 'Starting leaderboard rank recalculation');

    // Get all entries sorted by score
    const entries = await db.query.leaderboardEntries.findMany({
      where: eq(leaderboardEntries.season, season),
      orderBy: [desc(leaderboardEntries.score)],
    });

    // Update ranks
    for (let i = 0; i < entries.length; i++) {
      const newRank = i + 1;
      const newTier = getTierFromRank(newRank);

      await db
        .update(leaderboardEntries)
        .set({
          rank: newRank,
          tier: newTier,
          lastUpdatedAt: new Date(),
        })
        .where(eq(leaderboardEntries.id, entries[i].id));
    }

    logger.info(
      { season, count: entries.length },
      'Leaderboard rank recalculation completed'
    );
  } catch (err) {
    logger.error({ error: err, season }, 'Failed to recalculate leaderboard ranks');
  }
}
