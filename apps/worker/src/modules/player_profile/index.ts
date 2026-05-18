import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";
import { getPlayerAccount } from "../player_auth";

export type PlayerProfile = {
  playerId: string;
  level: number;
  winRate: number;
  items: string[];
  customData: Record<string, any>;
  updatedAt: string;
};

const PROFILE_PREFIX = "players/";
const PROFILE_SUFFIX = "/profile.json";

function getProfileKey(playerId: string): string {
  return `${PROFILE_PREFIX}${playerId}${PROFILE_SUFFIX}`;
}

async function loadProfile(bucket: R2Bucket | undefined, playerId: string): Promise<PlayerProfile> {
  const defaultProfile: PlayerProfile = {
    playerId,
    level: 1,
    winRate: 0,
    items: [],
    customData: {},
    updatedAt: new Date().toISOString(),
  };

  if (!bucket) return defaultProfile;

  const object = await bucket.get(getProfileKey(playerId));
  if (!object) return defaultProfile;

  try {
    const data = JSON.parse(await object.text()) as Partial<PlayerProfile>;
    return {
      playerId,
      level: data.level ?? 1,
      winRate: data.winRate ?? 0,
      items: Array.isArray(data.items) ? data.items : [],
      customData: typeof data.customData === "object" ? data.customData : {},
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return defaultProfile;
  }
}

async function saveProfile(bucket: R2Bucket | undefined, profile: PlayerProfile): Promise<void> {
  if (!bucket) return;
  profile.updatedAt = new Date().toISOString();
  await bucket.put(getProfileKey(profile.playerId), JSON.stringify(profile), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export const playerProfileManifest: ModuleManifest = {
  id: "player_profile",
  name: "Player Profile",
  description: "Detailed player stats, items, and custom data.",
  icon: "ti-user-circle",
};

export const playerProfileModule: WorkerModule = {
  manifest: playerProfileManifest,
  init(app: Hono<any>) {
    app.get("/profile/:id", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "playerProfile");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const playerId = c.req.param("id");
      
      // Optionally fetch public account info
      const account = await getPlayerAccount(c.env.PLATFORM_BUCKET, playerId);
      if (!account) return c.json({ error: "PLAYER_NOT_FOUND" }, 404);

      const profile = await loadProfile(c.env.PLATFORM_BUCKET, playerId);
      return c.json({
        playerName: account.playerName,
        lastSeen: account.lastSeen,
        ...profile
      });
    });

    app.patch("/profile", async (c) => {
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "playerProfile");
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const body = (await c.req.json().catch(() => ({}))) as Partial<PlayerProfile>;
      
      if (!body.playerId) {
        return c.json({ error: "INVALID_REQUEST", message: "playerId required" }, 400);
      }

      // Load existing
      const profile = await loadProfile(c.env.PLATFORM_BUCKET, body.playerId);

      // Merge updates
      if (typeof body.level === "number") profile.level = body.level;
      if (typeof body.winRate === "number") profile.winRate = body.winRate;
      if (Array.isArray(body.items)) profile.items = body.items;
      if (typeof body.customData === "object") {
        profile.customData = { ...profile.customData, ...body.customData };
      }

      await saveProfile(c.env.PLATFORM_BUCKET, profile);
      return c.json({ success: true, profile });
    });
  },
};
