DROP TABLE IF EXISTS leaderboard;
CREATE TABLE leaderboard (
  leaderboard_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (leaderboard_id, player_id)
);

CREATE INDEX idx_leaderboard_score ON leaderboard (leaderboard_id, score DESC);
