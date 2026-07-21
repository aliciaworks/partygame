-- Migration: Leaderboards
-- Global high scores and rankings

CREATE TABLE IF NOT EXISTS leaderboard (
  leaderboard_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT 'Unknown',
  score INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (leaderboard_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(leaderboard_id, score DESC);
