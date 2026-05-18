-- Migration: Seasons System

CREATE TABLE IF NOT EXISTS player_season_progress (
  player_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  claimed_tiers TEXT NOT NULL DEFAULT '[]', -- JSON array of tier IDs
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, season_id)
);
