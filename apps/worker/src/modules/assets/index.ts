import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import type { AppEnv } from "../../env";
import { isFeatureEnabled } from "../../platform-state";
import { selectVariant, extractWatermark } from "./watermark-engine";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetManifest = {
  assetId: string;
  name: string;
  tags: string[];
  variantCount: number;
  watermarkEnabled: boolean;
  serverTiers: string[];
  originalSize: number;
  uploadedAt: string;
  updatedAt: string;
};

type AssetIndex = { assets: AssetManifest[]; updatedAt: string };

// ─── R2 keys ─────────────────────────────────────────────────────────────────

const PREFIX = "game-assets/";

function vKey(assetId: string, idx: number) {
  return `${PREFIX}${assetId}/v${idx}.bin`;
}
function mKey(assetId: string) {
  return `${PREFIX}${assetId}/manifest.json`;
}
const INDEX_KEY = `${PREFIX}index.json`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => c[x % c.length]).join("");
}

async function idx(bucket?: R2Bucket): Promise<AssetIndex> {
  if (!bucket) return { assets: [], updatedAt: new Date().toISOString() };
  try {
    const o = await bucket.get(INDEX_KEY);
    if (!o) return { assets: [], updatedAt: new Date().toISOString() };
    const p = JSON.parse(await o.text()) as Partial<AssetIndex>;
    return { assets: Array.isArray(p.assets) ? p.assets : [], updatedAt: p.updatedAt ?? "" };
  } catch {
    return { assets: [], updatedAt: new Date().toISOString() };
  }
}

async function saveIndex(bucket?: R2Bucket, data?: AssetIndex) {
  if (!bucket || !data) return;
  await bucket.put(INDEX_KEY, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function getManifest(bucket?: R2Bucket, assetId?: string): Promise<AssetManifest | null> {
  if (!bucket || !assetId) return null;
  try {
    const o = await bucket.get(mKey(assetId));
    return o ? (JSON.parse(await o.text()) as AssetManifest) : null;
  } catch {
    return null;
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

export const assetsManifest: ModuleManifest = {
  id: "assets",
  name: "Asset Manager",
  description: "Upload, watermark, and A/B test game assets with variant distribution.",
  icon: "ti-package",
};

export const assetsModule: WorkerModule = {
  manifest: assetsManifest,
  init(app: Hono<AppEnv>) {
    // ── Create asset ──
    app.post("/admin/assets", async (c) => {
      const b = (await c.req.json().catch(() => ({}))) as any;
      const name = (b.name ?? "").trim();
      if (!name) return c.json({ error: "name is required" }, 400);

      const wm = b.watermarkEnabled === true;
      const vc = Math.max(1, Math.min(256, Math.floor(b.variantCount ?? 4)));
      const tags = Array.isArray(b.tags) ? b.tags.filter((t: any) => typeof t === "string") : [];
      const tiers = Array.isArray(b.serverTiers)
        ? b.serverTiers.filter((t: any) => typeof t === "string")
        : [];

      const assetId = uid();
      const now = new Date().toISOString();
      const m: AssetManifest = {
        assetId,
        name,
        tags,
        variantCount: wm ? vc : 1,
        watermarkEnabled: wm,
        serverTiers: tiers,
        originalSize: 0,
        uploadedAt: now,
        updatedAt: now,
      };

      if (c.env.PLATFORM_BUCKET) {
        await c.env.PLATFORM_BUCKET.put(mKey(assetId), JSON.stringify(m, null, 2), {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        });
      }

      const index = await idx(c.env.PLATFORM_BUCKET);
      index.assets.push(m);
      index.updatedAt = now;
      await saveIndex(c.env.PLATFORM_BUCKET, index);

      return c.json({
        assetId,
        manifest: m,
        uploadUrls: Array.from({ length: m.variantCount }, (_, v) => ({
          variantIndex: v,
          uploadUrl: `/admin/assets/${assetId}/variant/${v}/upload`,
        })),
        variantCount: m.variantCount,
      });
    });

    // ── Upload variant ──
    app.put("/admin/assets/:assetId/variant/:idx/upload", async (c) => {
      const assetId = c.req.param("assetId");
      const vi = parseInt(c.req.param("idx"), 10);
      const existing = await getManifest(c.env.PLATFORM_BUCKET, assetId);
      if (!existing) return c.json({ error: "Not found" }, 404);
      if (vi < 0 || vi >= existing.variantCount) return c.json({ error: "Bad index" }, 400);

      const body = await c.req.arrayBuffer();
      if (!body.byteLength) return c.json({ error: "Empty" }, 400);
      const data = new Uint8Array(body);

      // Validate watermark
      if (existing.watermarkEnabled) {
        const ext = extractWatermark(data);
        if (!ext) return c.json({ error: "Variant missing watermark block" }, 400);
        if (ext.variantIndex !== vi)
          return c.json({ error: `Index mismatch: expected ${vi}, got ${ext.variantIndex}` }, 400);
      }

      if (c.env.PLATFORM_BUCKET) {
        await c.env.PLATFORM_BUCKET.put(vKey(assetId, vi), data, {
          httpMetadata: { contentType: "application/octet-stream" },
        });
      }

      // Update size on first upload
      if (existing.originalSize === 0) {
        existing.originalSize = existing.watermarkEnabled ? body.byteLength - 38 : body.byteLength;
        existing.updatedAt = new Date().toISOString();
        if (c.env.PLATFORM_BUCKET) {
          await c.env.PLATFORM_BUCKET.put(mKey(assetId), JSON.stringify(existing, null, 2), {
            httpMetadata: { contentType: "application/json; charset=utf-8" },
          });
        }
        const index = await idx(c.env.PLATFORM_BUCKET);
        const i = index.assets.findIndex((a) => a.assetId === assetId);
        if (i !== -1) {
          index.assets[i] = existing;
          index.updatedAt = new Date().toISOString();
          await saveIndex(c.env.PLATFORM_BUCKET, index);
        }
      }

      return c.json({ success: true, assetId, variantIndex: vi });
    });

    // ── List assets ──
    app.get("/admin/assets", async (c) => {
      return c.json(await idx(c.env.PLATFORM_BUCKET));
    });

    // ── Delete asset ──
    app.delete("/admin/assets/:assetId", async (c) => {
      const assetId = c.req.param("assetId");
      const m = await getManifest(c.env.PLATFORM_BUCKET, assetId);
      if (!m) return c.json({ error: "Not found" }, 404);
      if (c.env.PLATFORM_BUCKET) {
        for (let v = 0; v < m.variantCount; v++)
          await c.env.PLATFORM_BUCKET.delete(vKey(assetId, v));
        await c.env.PLATFORM_BUCKET.delete(mKey(assetId));
      }
      const index = await idx(c.env.PLATFORM_BUCKET);
      index.assets = index.assets.filter((a) => a.assetId !== assetId);
      index.updatedAt = new Date().toISOString();
      await saveIndex(c.env.PLATFORM_BUCKET, index);
      return c.json({ success: true });
    });

    // ── Serve asset (public, deterministic variant selection) ──
    app.get("/api/assets/:assetId", async (c) => {
      const assetId = c.req.param("assetId");
      const userId = c.req.query("userId") || c.req.header("X-Player-Id") || "anonymous";
      const m = await getManifest(c.env.PLATFORM_BUCKET, assetId);
      if (!m) return c.json({ error: "Not found" }, 404);
      const secret = c.env.ADMIN_SECRET || c.env.ADMIN_TOKEN || "partygame-default-secret";

      const vi = m.watermarkEnabled
        ? await selectVariant(userId, assetId, m.variantCount, secret)
        : 0;

      if (!c.env.PLATFORM_BUCKET) return c.json({ error: "No storage" }, 500);
      const obj = await c.env.PLATFORM_BUCKET.get(vKey(assetId, vi));
      if (!obj) return c.json({ error: "Variant not found" }, 404);

      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${m.name}"`,
          "X-Asset-Variant": String(vi),
          "X-Asset-Variant-Count": String(m.variantCount),
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    });

    // ── Forensic extraction ──
    app.post("/admin/assets/forensic/watermark", async (c) => {
      const body = await c.req.arrayBuffer();
      const ext = extractWatermark(new Uint8Array(body));
      if (!ext) return c.json({ found: false, message: "No watermark block found." });
      return c.json({
        found: true,
        variantIndex: ext.variantIndex,
        payload: Array.from(ext.payload)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      });
    });
  },
};
