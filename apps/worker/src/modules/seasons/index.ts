import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

export const seasonsManifest: ModuleManifest = {
  id: "seasons",
  name: "Seasons (Battle Pass)",
  description: "Manage season progression, xp, and tier claims.",
  icon: "ti-star",
};

export const seasonsModule: WorkerModule = {
  manifest: seasonsManifest,
  init(app: Hono<any>) {
    app.get("/seasons/progress", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "seasons");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const playerId = c.req.query("playerId");
      const seasonId = c.req.query("seasonId");

      if (!playerId || !seasonId) {
        return c.json({ error: "Missing playerId or seasonId" }, 400);
      }

      const row = await c.env.DB.prepare(
        "SELECT xp, claimed_tiers FROM player_season_progress WHERE player_id = ? AND season_id = ?"
      )
        .bind(playerId, seasonId)
        .first();

      if (!row) {
        return c.json({
          playerId,
          seasonId,
          xp: 0,
          claimedTiers: [],
        });
      }

      let claimedTiers: string[] = [];
      try {
        claimedTiers = JSON.parse(row.claimed_tiers as string);
      } catch {
        claimedTiers = [];
      }

      return c.json({
        playerId,
        seasonId,
        xp: row.xp as number,
        claimedTiers,
      });
    });

    app.post("/seasons/progress/add-xp", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "seasons");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const body = await c.req.json().catch(() => ({}));
      const { playerId, seasonId, xp } = body;

      if (!playerId || !seasonId || typeof xp !== "number") {
        return c.json({ error: "Missing required fields: playerId, seasonId, xp" }, 400);
      }

      await c.env.DB.prepare(`
        INSERT INTO player_season_progress (player_id, season_id, xp, claimed_tiers)
        VALUES (?, ?, ?, '[]')
        ON CONFLICT (player_id, season_id) DO UPDATE SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP
      `)
        .bind(playerId, seasonId, xp, xp)
        .run();

      const row = await c.env.DB.prepare(
        "SELECT xp FROM player_season_progress WHERE player_id = ? AND season_id = ?"
      )
        .bind(playerId, seasonId)
        .first();

      return c.json({ success: true, playerId, seasonId, xp: row?.xp || 0 });
    });

    app.post("/seasons/progress/claim-tier", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "seasons");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const body = await c.req.json().catch(() => ({}));
      const { playerId, seasonId, tierId } = body;

      if (!playerId || !seasonId || !tierId) {
        return c.json({ error: "Missing required fields: playerId, seasonId, tierId" }, 400);
      }

      // Read current
      const row = await c.env.DB.prepare(
        "SELECT claimed_tiers FROM player_season_progress WHERE player_id = ? AND season_id = ?"
      )
        .bind(playerId, seasonId)
        .first();

      let claimedTiers: string[] = [];
      if (row) {
        try {
          claimedTiers = JSON.parse(row.claimed_tiers as string);
        } catch {}
      }

      if (claimedTiers.includes(tierId)) {
        return c.json({ success: false, error: "ALREADY_CLAIMED" });
      }

      claimedTiers.push(tierId);
      const newClaimedTiers = JSON.stringify(claimedTiers);

      if (row) {
        await c.env.DB.prepare(
          "UPDATE player_season_progress SET claimed_tiers = ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND season_id = ?"
        )
          .bind(newClaimedTiers, playerId, seasonId)
          .run();
      } else {
        await c.env.DB.prepare(
          "INSERT INTO player_season_progress (player_id, season_id, xp, claimed_tiers) VALUES (?, ?, 0, ?)"
        )
          .bind(playerId, seasonId, newClaimedTiers)
          .run();
      }

      return c.json({ success: true, playerId, seasonId, claimedTiers });
    });
  },
};
