import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { getPlayerAccount, listPlayerAccounts, revokePlayerSessions } from "../player_auth/index";

type BanRecord = {
  playerId: string;
  reason: string;
  bannedBy: string;
  bannedAt: string;
  expiresAt?: string;
};

type AuditRecord = {
  action: string;
  targetPlayerId?: string;
  adminId: string;
  detail: string;
  timestamp: string;
};

const PLAYERS_PREFIX = "players/";
const AUDIT_PREFIX = "players/_audit/";
const AUDIT_RETENTION_DAYS = 90;
const AUDIT_CLEANUP_BATCH_SIZE = 50;

function banKey(playerId: string): string {
  return `${PLAYERS_PREFIX}${playerId}/ban.json`;
}

function auditKey(timestamp: string): string {
  return `${AUDIT_PREFIX}${timestamp}-${crypto.randomUUID()}.json`;
}

function extractAdminId(request: Request): string {
  return request.headers.get("x-admin-id") ?? request.headers.get("x-admin-token") ?? "admin";
}

async function cleanupOldAuditRecords(bucket: R2Bucket): Promise<void> {
  const cutoff = Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const listed = await bucket.list({ prefix: AUDIT_PREFIX, limit: AUDIT_CLEANUP_BATCH_SIZE });
  for (const object of listed.objects) {
    if (object.uploaded.getTime() < cutoff) {
      await bucket.delete(object.key);
    }
  }
}

async function writeAudit(
  bucket: R2Bucket | undefined,
  record: AuditRecord,
): Promise<void> {
  if (!bucket) return;

  await bucket.put(auditKey(record.timestamp), JSON.stringify(record, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  await cleanupOldAuditRecords(bucket);
}

async function readBan(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<BanRecord | null> {
  if (!bucket) return null;

  const object = await bucket.get(banKey(playerId));
  if (!object) return null;

  try {
    return JSON.parse(await object.text()) as BanRecord;
  } catch {
    return null;
  }
}

export const playerManagementManifest: ModuleManifest = {
  id: "player_management",
  name: "Player management",
  description: "Admin tools for player lookup, ban, kick, and audit logs.",
  icon: "ti-user-shield",
};

export const playerManagementModule: WorkerModule = {
  manifest: playerManagementManifest,
  init(app: Hono<any>) {
    app.use("/admin/*", async (c, next) => {
      if (!c.get("isAdmin")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await next();
    });

    app.get("/admin/players", async (c) => {
      const limit = Number(c.req.query("limit") ?? "50");
      const cursor = c.req.query("cursor") ?? undefined;
      const listed = await listPlayerAccounts(c.env.PLATFORM_BUCKET, Number.isFinite(limit) ? limit : 50, cursor);

      const players = await Promise.all(
        listed.players.map(async (player) => ({
          ...player,
          ban: await readBan(c.env.PLATFORM_BUCKET, player.playerId),
        })),
      );

      return c.json({ players, cursor: listed.cursor ?? null });
    });

    app.get("/admin/players/:id", async (c) => {
      const playerId = c.req.param("id");
      const account = await getPlayerAccount(c.env.PLATFORM_BUCKET, playerId);
      if (!account) {
        return c.json({ error: "Not found" }, 404);
      }

      const ban = await readBan(c.env.PLATFORM_BUCKET, playerId);
      const progress = c.env.PLATFORM_BUCKET
        ? await c.env.PLATFORM_BUCKET.get(`players/${playerId}/progress.json`)
        : null;

      return c.json({
        account,
        ban,
        progress: progress ? JSON.parse(await progress.text()) : null,
      });
    });

    app.post("/admin/players/:id/ban", async (c) => {
      const playerId = c.req.param("id");
      const body = (await c.req.json().catch(() => ({}))) as {
        reason?: string;
        expiresAt?: string;
      };

      const record: BanRecord = {
        playerId,
        reason: body.reason?.trim() || "Banned by admin",
        bannedBy: extractAdminId(c.req.raw),
        bannedAt: new Date().toISOString(),
        expiresAt: body.expiresAt,
      };

      if (c.env.PLATFORM_BUCKET) {
        await c.env.PLATFORM_BUCKET.put(banKey(playerId), JSON.stringify(record, null, 2), {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        });

        const account = await getPlayerAccount(c.env.PLATFORM_BUCKET, playerId);
        if (account) {
          await c.env.PLATFORM_BUCKET.put(`players/${playerId}/account.json`, JSON.stringify({ ...account, banned: true }, null, 2), {
            httpMetadata: { contentType: "application/json; charset=utf-8" },
          });
        }
      }

      revokePlayerSessions(playerId);
      await writeAudit(c.env.PLATFORM_BUCKET, {
        action: "ban",
        targetPlayerId: playerId,
        adminId: extractAdminId(c.req.raw),
        detail: record.reason,
        timestamp: record.bannedAt,
      });

      return c.json({ success: true, ban: record });
    });

    app.post("/admin/players/:id/kick", async (c) => {
      const playerId = c.req.param("id");
      const timestamp = new Date().toISOString();

      revokePlayerSessions(playerId);
      await writeAudit(c.env.PLATFORM_BUCKET, {
        action: "kick",
        targetPlayerId: playerId,
        adminId: extractAdminId(c.req.raw),
        detail: "Forced disconnect requested",
        timestamp,
      });

      return c.json({ success: true });
    });

    app.delete("/admin/players/:id/ban", async (c) => {
      const playerId = c.req.param("id");
      if (c.env.PLATFORM_BUCKET) {
        await c.env.PLATFORM_BUCKET.delete(banKey(playerId));
        const account = await getPlayerAccount(c.env.PLATFORM_BUCKET, playerId);
        if (account) {
          await c.env.PLATFORM_BUCKET.put(`players/${playerId}/account.json`, JSON.stringify({ ...account, banned: false }, null, 2), {
            httpMetadata: { contentType: "application/json; charset=utf-8" },
          });
        }
      }

      await writeAudit(c.env.PLATFORM_BUCKET, {
        action: "unban",
        targetPlayerId: playerId,
        adminId: extractAdminId(c.req.raw),
        detail: "Ban removed",
        timestamp: new Date().toISOString(),
      });

      return c.json({ success: true });
    });

    app.get("/admin/audit", async (c) => {
      const bucket = c.env.PLATFORM_BUCKET;
      const limit = Number(c.req.query("limit") ?? "50");
      const cursor = c.req.query("cursor") ?? undefined;

      if (!bucket) {
        return c.json({ records: [], cursor: null });
      }
      const listed = await bucket.list({ prefix: AUDIT_PREFIX, limit: Number.isFinite(limit) ? limit : 50, cursor });
      const records: AuditRecord[] = [];

      for (const object of listed.objects) {
        const loaded = await bucket.get(object.key);
        if (!loaded) continue;

        try {
          records.push(JSON.parse(await loaded.text()) as AuditRecord);
        } catch {
          continue;
        }
      }

      records.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
      return c.json({ records, cursor: listed.cursor ?? null });
    });
  },
};
