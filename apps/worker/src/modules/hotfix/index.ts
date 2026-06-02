import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

type HotfixManifest = {
  version: string;
  gameVersionMin: string;
  files: string[];
  checksum: string;
  uploadedAt: string;
};

const HOTFIX_PREFIX = "game-updates/";
const LATEST_KEY = "game-updates/latest";
const INDEX_KEY = "game-updates/index.json";
const MAX_PATCH_SIZE_BYTES = 50 * 1024 * 1024;

type HotfixIndex = {
  latest: string | null;
  versions: HotfixManifest[];
  updatedAt: string;
};

function versionRoot(version: string): string {
  return `${HOTFIX_PREFIX}${version}`;
}

function manifestKey(version: string): string {
  return `${versionRoot(version)}/manifest.json`;
}

function patchKey(version: string): string {
  return `${versionRoot(version)}/patch.zip`;
}

async function readManifest(bucket: R2Bucket | undefined, version: string): Promise<HotfixManifest | null> {
  if (!bucket) return null;
  const object = await bucket.get(manifestKey(version));
  if (!object) return null;

  try {
    return JSON.parse(await object.text()) as HotfixManifest;
  } catch {
    return null;
  }
}

async function writeLatest(bucket: R2Bucket | undefined, version: string): Promise<void> {
  if (!bucket) return;
  await bucket.put(LATEST_KEY, version, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });
}

async function readLatest(bucket: R2Bucket | undefined): Promise<string | null> {
  if (!bucket) return null;
  const object = await bucket.get(LATEST_KEY);
  return object ? (await object.text()).trim() : null;
}

async function shaLike(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes as any);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function readIndex(bucket: R2Bucket | undefined): Promise<HotfixIndex> {
  if (!bucket) {
    return { latest: null, versions: [], updatedAt: new Date().toISOString() };
  }
  const object = await bucket.get(INDEX_KEY);
  if (!object) {
    return { latest: await readLatest(bucket), versions: [], updatedAt: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(await object.text()) as Partial<HotfixIndex>;
    return {
      latest: typeof parsed.latest === "string" ? parsed.latest : null,
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { latest: await readLatest(bucket), versions: [], updatedAt: new Date().toISOString() };
  }
}

async function writeIndex(bucket: R2Bucket | undefined, index: HotfixIndex): Promise<void> {
  if (!bucket) return;
  await bucket.put(INDEX_KEY, JSON.stringify(index, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function syncIndexVersion(
  bucket: R2Bucket | undefined,
  manifest: HotfixManifest,
  latestOverride?: string | null,
): Promise<void> {
  const index = await readIndex(bucket);
  const filtered = index.versions.filter((entry) => entry.version !== manifest.version);
  filtered.push(manifest);
  filtered.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  await writeIndex(bucket, {
    latest: latestOverride === undefined ? index.latest : latestOverride,
    versions: filtered,
    updatedAt: new Date().toISOString(),
  });
}

async function removeIndexVersion(bucket: R2Bucket | undefined, version: string): Promise<void> {
  const index = await readIndex(bucket);
  const filtered = index.versions.filter((entry) => entry.version !== version);
  const nextLatest = index.latest === version ? null : index.latest;
  await writeIndex(bucket, {
    latest: nextLatest,
    versions: filtered,
    updatedAt: new Date().toISOString(),
  });
}

export const hotfixManifest: ModuleManifest = {
  id: "hotfix",
  name: "Hotfix & releases",
  description: "Upload, list, promote, rollback, and delete client patches.",
  icon: "ti-package",
};

export const hotfixModule: WorkerModule = {
  manifest: hotfixManifest,
  init(app: Hono<any>) {
    app.use("/hotfix/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "gameUpdates"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "gameUpdates" }, 403);
      }

      await next();
    });

    app.post("/hotfix/upload", async (c) => {
      const contentType = c.req.header("content-type") ?? "";
      let version: string | undefined;
      let gameVersionMin = "0.0.0";
      let patch: Uint8Array | ArrayBuffer | undefined;
      let providedChecksum: string | undefined;

      if (contentType.includes("multipart/form-data")) {
        const form = await c.req.formData();
        const formVersion = form.get("version");
        const formGameVersionMin = form.get("gameVersionMin");
        const formChecksum = form.get("checksum");
        version = typeof formVersion === "string" ? formVersion : undefined;
        gameVersionMin = typeof formGameVersionMin === "string" ? formGameVersionMin : gameVersionMin;
        providedChecksum = typeof formChecksum === "string" ? formChecksum.trim().toLowerCase() : undefined;
        const file = form.get("file");
        if (file instanceof File) {
          patch = new Uint8Array(await file.arrayBuffer());
        }
      } else {
        const body = (await c.req.json().catch(() => ({}))) as {
          version?: string;
          gameVersionMin?: string;
          contentBase64?: string;
          checksum?: string;
        };
        version = body.version;
        gameVersionMin = body.gameVersionMin ?? gameVersionMin;
        providedChecksum = body.checksum?.trim().toLowerCase();
        patch = body.contentBase64 ? Uint8Array.from(atob(body.contentBase64), (ch) => ch.charCodeAt(0)) : undefined;
      }

      if (!patch) {
        return c.json({ error: "file/contentBase64 is required" }, 400);
      }
      if ((patch instanceof Uint8Array ? patch.byteLength : patch.byteLength) > MAX_PATCH_SIZE_BYTES) {
        return c.json({ error: "PATCH_TOO_LARGE", maxBytes: MAX_PATCH_SIZE_BYTES }, 413);
      }

      version = version?.trim() || `v-${Date.now()}`;
      const checksum = await shaLike(patch);
      if (providedChecksum && providedChecksum !== checksum) {
        return c.json({ error: "CHECKSUM_MISMATCH", expected: providedChecksum, actual: checksum }, 400);
      }
      const manifest: HotfixManifest = {
        version,
        gameVersionMin,
        files: ["patch.zip"],
        checksum,
        uploadedAt: new Date().toISOString(),
      };

      if (c.env.PLATFORM_BUCKET) {
        await c.env.PLATFORM_BUCKET.put(patchKey(version), patch instanceof Uint8Array ? patch : new Uint8Array(patch), {
          httpMetadata: { contentType: "application/zip" },
        });
        await c.env.PLATFORM_BUCKET.put(manifestKey(version), JSON.stringify(manifest, null, 2), {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        });
      }

      if (c.req.query("autoPromote") !== "false") {
        await writeLatest(c.env.PLATFORM_BUCKET, version);
        await syncIndexVersion(c.env.PLATFORM_BUCKET, manifest, version);
      } else {
        await syncIndexVersion(c.env.PLATFORM_BUCKET, manifest);
      }

      return c.json({ manifest });
    });

    app.get("/hotfix/list", async (c) => {
      const bucket = c.env.PLATFORM_BUCKET;
      if (!bucket) return c.json({ versions: [] });

      const index = await readIndex(bucket);
      return c.json({ versions: index.versions, latest: index.latest ?? (await readLatest(bucket)) });
    });

    app.get("/hotfix/latest", async (c) => {
      const bucket = c.env.PLATFORM_BUCKET;
      const latest = await readLatest(bucket);
      if (!latest) {
        return c.json({ error: "Not found" }, 404);
      }

      const manifest = await readManifest(bucket, latest);
      if (!manifest) {
        return c.json({ error: "Not found" }, 404);
      }

      return c.json({ manifest });
    });

    app.get("/hotfix/:version/patch", async (c) => {
      const version = c.req.param("version");
      const bucket = c.env.PLATFORM_BUCKET;
      if (!bucket) {
        return c.json({ error: "Not found" }, 404);
      }

      const object = await bucket.get(`${versionRoot(version)}/patch.zip`);
      if (!object) {
        return c.json({ error: "Not found" }, 404);
      }

      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType ?? "application/zip",
          "Content-Disposition": `attachment; filename="${version}.zip"`,
        },
      });
    });

    app.post("/hotfix/promote/:version", async (c) => {
      const version = c.req.param("version");
      const manifest = await readManifest(c.env.PLATFORM_BUCKET, version);
      if (!manifest) {
        return c.json({ error: "Not found" }, 404);
      }

      await writeLatest(c.env.PLATFORM_BUCKET, version);
      await syncIndexVersion(c.env.PLATFORM_BUCKET, manifest, version);
      return c.json({ success: true, latest: version });
    });

    app.post("/hotfix/rollback/:version", async (c) => {
      const version = c.req.param("version");
      const manifest = await readManifest(c.env.PLATFORM_BUCKET, version);
      if (!manifest) {
        return c.json({ error: "Not found" }, 404);
      }

      await writeLatest(c.env.PLATFORM_BUCKET, version);
      await syncIndexVersion(c.env.PLATFORM_BUCKET, manifest, version);
      return c.json({ success: true, latest: version });
    });

    app.delete("/hotfix/:version", async (c) => {
      const version = c.req.param("version");
      const bucket = c.env.PLATFORM_BUCKET;
      if (bucket) {
        await bucket.delete(patchKey(version));
        await bucket.delete(manifestKey(version));
        if ((await readLatest(bucket)) === version) {
          await bucket.delete(LATEST_KEY);
        }
      }
      await removeIndexVersion(c.env.PLATFORM_BUCKET, version);

      return c.json({ success: true });
    });
  },
};
