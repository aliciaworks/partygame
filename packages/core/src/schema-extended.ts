/**
 * Database Schema Extensions for Phase 2 & 3 Features
 * Drizzle ORM schema definitions for:
 * - Room persistence
 * - Leaderboard / Rankings
 * - Achievements
 * - Chat history
 * - Player inventory
 * - Replay data
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Rooms table - Persistent game room state
 */
export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(), // Durable Object ID
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    state: text('state').notNull(), // JSON-serialized game state
    maxPlayers: integer('max_players').notNull().default(8),
    currentPlayerCount: integer('current_player_count').notNull().default(0),
    status: text('status').notNull().default('active'), // active, finished, archived
    createdBy: text('created_by').notNull(),
    metadata: text('metadata'), // JSON extra data
  },
  (table) => ({
    statusIdx: index('idx_rooms_status').on(table.status),
    createdAtIdx: index('idx_rooms_created_at').on(table.createdAt),
  })
);

/**
 * Room snapshots table - Historical room state for replay
 */
export const roomSnapshots = sqliteTable(
  'room_snapshots',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id').notNull(),
    tickNumber: integer('tick_number').notNull(),
    state: text('state').notNull(), // JSON
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    dataSize: integer('data_size').notNull(), // For storage monitoring
  },
  (table) => ({
    roomIdIdx: index('idx_snapshots_room_id').on(table.roomId),
    tickIdx: uniqueIndex('idx_snapshots_room_tick').on(table.roomId, table.tickNumber),
  })
);

/**
 * Players table - Player profile & persistent data
 */
export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    totalGamesPlayed: integer('total_games_played').notNull().default(0),
    totalWins: integer('total_wins').notNull().default(0),
    totalScore: integer('total_score').notNull().default(0),
    level: integer('level').notNull().default(1),
    experience: integer('experience').notNull().default(0),
    currency: integer('currency').notNull().default(0), // Soft currency
    premiumCurrency: integer('premium_currency').notNull().default(0), // Hard currency
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
    banned: integer('banned', { mode: 'boolean' }).notNull().default(false),
    metadata: text('metadata'), // JSON
  },
  (table) => ({
    emailIdx: uniqueIndex('idx_players_email').on(table.email),
    levelIdx: index('idx_players_level').on(table.level),
  })
);

/**
 * Leaderboard entries - Ranked scores
 */
export const leaderboardEntries = sqliteTable(
  'leaderboard_entries',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull(),
    playerName: text('player_name').notNull(),
    score: integer('score').notNull(),
    rank: integer('rank').notNull(),
    season: integer('season').notNull(), // Season number for seasonal rankings
    lastUpdatedAt: integer('last_updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    tier: text('tier').notNull().default('bronze'), // bronze, silver, gold, platinum, diamond
  },
  (table) => ({
    playerIdIdx: index('idx_leaderboard_player').on(table.playerId),
    scoreIdx: index('idx_leaderboard_score').on(table.score),
    seasonIdx: index('idx_leaderboard_season').on(table.season),
    rankIdx: uniqueIndex('idx_leaderboard_rank').on(table.season, table.rank),
  })
);

/**
 * Achievements table - Achievement definitions
 */
export const achievements = sqliteTable('achievements', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon'),
  category: text('category').notNull(), // gameplay, social, progression, special
  points: integer('points').notNull().default(10),
  rarity: text('rarity').notNull().default('common'), // common, rare, epic, legendary
  requirement: text('requirement').notNull(), // JSON with condition details
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Player achievements - Earned achievements
 */
export const playerAchievements = sqliteTable(
  'player_achievements',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull(),
    achievementId: text('achievement_id').notNull(),
    unlockedAt: integer('unlocked_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    progress: integer('progress').notNull().default(0), // For progress-based achievements
    metadata: text('metadata'), // JSON
  },
  (table) => ({
    playerAchievementIdx: uniqueIndex('idx_player_achievement').on(
      table.playerId,
      table.achievementId
    ),
    playerIdIdx: index('idx_player_achievements').on(table.playerId),
  })
);

/**
 * Chat messages - Game and room chat
 */
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id'),
    playerId: text('player_id').notNull(),
    playerName: text('player_name').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull().default('message'), // message, system_notification
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    roomIdIdx: index('idx_chat_room').on(table.roomId),
    playerIdIdx: index('idx_chat_player').on(table.playerId),
    createdAtIdx: index('idx_chat_created_at').on(table.createdAt),
  })
);

/**
 * Inventory items - Player item ownership
 */
export const inventoryItems = sqliteTable(
  'inventory_items',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull(),
    itemId: text('item_id').notNull(),
    itemName: text('item_name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    acquiredAt: integer('acquired_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    metadata: text('metadata'), // JSON
  },
  (table) => ({
    playerItemIdx: uniqueIndex('idx_inventory_player_item').on(table.playerId, table.itemId),
    playerIdIdx: index('idx_inventory_player').on(table.playerId),
  })
);

/**
 * Purchase transactions - Item purchase history
 */
export const purchaseTransactions = sqliteTable(
  'purchase_transactions',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id').notNull(),
    itemId: text('item_id').notNull(),
    itemName: text('item_name').notNull(),
    amount: integer('amount').notNull(),
    currencyType: text('currency_type').notNull(), // soft, premium
    receiptId: text('receipt_id'),
    status: text('status').notNull().default('completed'), // pending, completed, failed, refunded
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    metadata: text('metadata'), // JSON for receipts, etc.
  },
  (table) => ({
    playerIdIdx: index('idx_purchase_player').on(table.playerId),
    statusIdx: index('idx_purchase_status').on(table.status),
    createdAtIdx: index('idx_purchase_created').on(table.createdAt),
  })
);

/**
 * Replay sessions - Recording metadata
 */
export const replaySessions = sqliteTable(
  'replay_sessions',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id').notNull(),
    duration: integer('duration').notNull(), // seconds
    tickCount: integer('tick_count').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    dataUrl: text('data_url'), // URL to replay data storage
    fileSize: integer('file_size'), // bytes
  },
  (table) => ({
    roomIdIdx: index('idx_replay_room').on(table.roomId),
    createdAtIdx: index('idx_replay_created').on(table.createdAt),
  })
);

/**
 * Feature flags - Feature toggle configuration
 */
export const featureFlags = sqliteTable(
  'feature_flags',
  {
    id: text('id').primaryKey(),
    name: text('name').unique().notNull(),
    description: text('description'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    rolloutPercentage: integer('rollout_percentage').notNull().default(0), // 0-100
    targetPlayers: text('target_players'), // JSON array of player IDs
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    nameIdx: uniqueIndex('idx_flag_name').on(table.name),
  })
);

/**
 * Analytics events - User behavior tracking
 */
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    playerId: text('player_id'),
    eventName: text('event_name').notNull(),
    eventData: text('event_data'), // JSON
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    playerIdIdx: index('idx_analytics_player').on(table.playerId),
    eventIdx: index('idx_analytics_event').on(table.eventName),
    timeIdx: index('idx_analytics_time').on(table.createdAt),
  })
);
