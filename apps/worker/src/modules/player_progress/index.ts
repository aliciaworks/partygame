import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { getPlayerAccount } from "../player_auth/index";
import { isFeatureEnabled } from "../../platform-state";

type ProgressRecord = {
  playerId: string;
  xp: number;
  level: number;
  matchesPlayed: number;
  matchesWon: number;
  customData: unknown;
  updatedAt: string;
};

const PLAYERS_PREFIX = "players/";
const PLAYER_PROGRESS_SUFFIX = "/progress.json";

function progressKey(playerId: string): string {
  return `${PLAYERS_PREFIX}${playerId}${PLAYER_PROGRESS_SUFFIX}`;
}

function defaultProgress(playerId: string): ProgressRecord {
  return {
    playerId,
    xp: 0,
    level: 1,
    matchesPlayed: 0,
    matchesWon: 0,
    customData: {},
    updatedAt: new Date().toISOString(),
  };
}

async function readProgress(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<ProgressRecord> {
  if (!bucket) return defaultProgress(playerId);

  const object = await bucket.get(progressKey(playerId));
  if (!object) return defaultProgress(playerId);

  try {
    const parsed = JSON.parse(await object.text()) as Partial<ProgressRecord>;
    return {
      playerId,
      xp: typeof parsed.xp === "number" ? parsed.xp : 0,
      level: typeof parsed.level === "number" ? parsed.level : 1,
      matchesPlayed: typeof parsed.matchesPlayed === "number" ? parsed.matchesPlayed : 0,
      matchesWon: typeof parsed.matchesWon === "number" ? parsed.matchesWon : 0,
      customData: parsed.customData ?? {},
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return defaultProgress(playerId);
  }
}

async function writeProgress(
  bucket: R2Bucket | undefined,
  record: ProgressRecord,
): Promise<void> {
  if (!bucket) return;

  await bucket.put(progressKey(record.playerId), JSON.stringify(record, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export const playerProgressManifest: ModuleManifest = {
  id: "player_progress",
  name: "Player progress",
  description: "Per-player progress storage, stats, and leaderboard export.",
  icon: "ti-chart-arcs",
};

export const playerProgressModule: WorkerModule = {
  manifest: playerProgressManifest,
  init(app: Hono<any>) {
    app.use("/progress", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "playerProfile"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "playerProfile" }, 403);
      }

      await next();
    });

    app.use("/progress/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "playerProfile"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "playerProfile" }, 403);
      }

      await next();
    });

    app.get("/progress", async (c) => {
      const playerId = c.req.query("playerId") ?? c.req.header("x-player-id");
      if (!playerId) {
        return c.json({ error: "playerId is required" }, 400);
      }

      const progress = await readProgress(c.env.PLATFORM_BUCKET, playerId);
      return c.json({ progress });
    });

    app.patch("/progress", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as Partial<ProgressRecord> & {
        playerId?: string;
      };

      const playerId = body.playerId ?? c.req.query("playerId") ?? c.req.header("x-player-id");
      if (!playerId) {
        return c.json({ error: "playerId is required" }, 400);
      }

      const current = await readProgress(c.env.PLATFORM_BUCKET, playerId);
      const next: ProgressRecord = {
        ...current,
        xp: typeof body.xp === "number" ? body.xp : current.xp,
        level: typeof body.level === "number" ? body.level : current.level,
        matchesPlayed: typeof body.matchesPlayed === "number" ? body.matchesPlayed : current.matchesPlayed,
        matchesWon: typeof body.matchesWon === "number" ? body.matchesWon : current.matchesWon,
        customData: body.customData ?? current.customData,
        updatedAt: new Date().toISOString(),
      };

      const encoded = JSON.stringify(next.customData);
      if (encoded.length > 64 * 1024) {
        return c.json({ error: "customData too large" }, 413);
      }

      await writeProgress(c.env.PLATFORM_BUCKET, next);
      return c.json({ progress: next });
    });

    app.get("/progress/:playerId", async (c) => {
      const playerId = c.req.param("playerId");
      const account = await getPlayerAccount(c.env.PLATFORM_BUCKET, playerId);
      if (!account) {
        return c.json({ error: "Not found" }, 404);
      }

      return c.json({ progress: await readProgress(c.env.PLATFORM_BUCKET, playerId), account });
    });

    app.delete("/progress/:playerId", async (c) => {
      const playerId = c.req.param("playerId");
      if (c.env.PLATFORM_BUCKET) {
        await c.env.PLATFORM_BUCKET.delete(progressKey(playerId));
      }

      return c.json({ success: true });
    });

    app.get("/progress/leaderboard", async (c) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "leaderboard"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "leaderboard" }, 403);
      }

      const limit = Number(c.req.query("limit") ?? "50");
      const listed = c.env.PLATFORM_BUCKET
        ? await c.env.PLATFORM_BUCKET.list({ prefix: PLAYERS_PREFIX })
        : { objects: [] as Array<{ key: string }> };

      const ids: string[] = listed.objects
        .map((object: { key: string }) => object.key)
        .filter((key: string) => key.endsWith(PLAYER_PROGRESS_SUFFIX))
        .map((key: string) =>
          key.slice(PLAYERS_PREFIX.length, -PLAYER_PROGRESS_SUFFIX.length),
        );
      const uniqueIds: string[] = [...new Set(ids)];

      const entries: Array<Pick<ProgressRecord, "playerId" | "xp" | "level" | "matchesPlayed" | "matchesWon">> = [];
      for (const playerId of uniqueIds.slice(0, Number.isFinite(limit) ? limit : 50)) {
        const progress = await readProgress(c.env.PLATFORM_BUCKET, playerId);
        entries.push({
          playerId,
          xp: progress.xp,
          level: progress.level,
          matchesPlayed: progress.matchesPlayed,
          matchesWon: progress.matchesWon,
        });
      }

      entries.sort((left, right) => right.xp - left.xp);
      return c.json({ entries: entries.slice(0, Number.isFinite(limit) ? limit : 50) });
    });
  },
};
