import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

export type LeaderboardEntry = {
  playerId: string;
  playerName: string;
  score: number;
  timestamp: string;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  updatedAt: string;
};

export const leaderboardManifest: ModuleManifest = {
  id: "leaderboard",
  name: "Leaderboard",
  description: "Global high scores and rankings backed by D1.",
  icon: "ti-medal",
};

export const leaderboardModule: WorkerModule<{ DB: D1Database }> = {
  manifest: leaderboardManifest,
  init(app: Hono<any>) {
    app.get("/leaderboard/:id", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "leaderboard");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const leaderboardId = c.req.param("id");
      
      const { results } = await c.env.DB.prepare(
        "SELECT player_id as playerId, player_name as playerName, score, updated_at as timestamp FROM leaderboard WHERE leaderboard_id = ? ORDER BY score DESC LIMIT 100"
      ).bind(leaderboardId).all();

      return c.json({
        entries: results || [],
        updatedAt: new Date().toISOString(),
      });
    });

    app.post("/leaderboard/:id/submit", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "leaderboard");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const body = (await c.req.json().catch(() => ({}))) as {
        playerId?: string;
        playerName?: string;
        score?: number;
      };

      if (!body.playerId || typeof body.score !== "number") {
        return c.json({ error: "INVALID_REQUEST" }, 400);
      }

      const leaderboardId = c.req.param("id");
      const playerName = body.playerName || "Unknown";

      // Async: write to Queue for batch processing (avoids D1 write lock contention)
      if (c.env.MATCH_QUEUE) {
        await c.env.MATCH_QUEUE.send({
          type: "LEADERBOARD_SUBMIT",
          leaderboardId,
          playerId: body.playerId,
          playerName,
          score: body.score,
          timestamp: Date.now(),
        });
        return c.json({ success: true, queued: true });
      }

      // Fallback: direct D1 write when Queue is unavailable
      await c.env.DB.prepare(
        `INSERT INTO leaderboard (leaderboard_id, player_id, player_name, score) 
         VALUES (?, ?, ?, ?) 
         ON CONFLICT(leaderboard_id, player_id) DO UPDATE SET 
         score = excluded.score, 
         player_name = excluded.player_name, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE excluded.score > leaderboard.score`
      ).bind(leaderboardId, body.playerId, playerName, body.score).run();

      return c.json({ success: true });
    });
  },
};

