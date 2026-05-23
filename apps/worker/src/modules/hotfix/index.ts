import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";

type HotfixManifest = {
  version: string;
  gameVersionMin: string;
  files: string[];
  checksum: string;
  uploadedAt: string;
};

const HOTFIX_PREFIX = "hotfix/";
const LATEST_KEY = "hotfix/latest";

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

function shaLike(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return Array.from(bytes.slice(0, 8), (value) => value.toString(16).padStart(2, "0")).join("");
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
    app.post("/hotfix/upload", async (c) => {
      const contentType = c.req.header("content-type") ?? "";
      let version: string | undefined;
      let gameVersionMin = "0.0.0";
      let patch: Uint8Array | ArrayBuffer | undefined;

      if (contentType.includes("multipart/form-data")) {
        const form = await c.req.formData();
        const formVersion = form.get("version");
        const formGameVersionMin = form.get("gameVersionMin");
        version = typeof formVersion === "string" ? formVersion : undefined;
        gameVersionMin = typeof formGameVersionMin === "string" ? formGameVersionMin : gameVersionMin;
        const file = form.get("file");
        if (file instanceof File) {
          patch = new Uint8Array(await file.arrayBuffer());
        }
      } else {
        const body = (await c.req.json().catch(() => ({}))) as {
          version?: string;
          gameVersionMin?: string;
          contentBase64?: string;
        };
        version = body.version;
        gameVersionMin = body.gameVersionMin ?? gameVersionMin;
        patch = body.contentBase64 ? Uint8Array.from(atob(body.contentBase64), (ch) => ch.charCodeAt(0)) : undefined;
      }

      if (!patch) {
        return c.json({ error: "file/contentBase64 is required" }, 400);
      }

      version = version?.trim() || `v-${Date.now()}`;
      const checksum = shaLike(patch);
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
      }

      return c.json({ manifest });
    });

    app.get("/hotfix/list", async (c) => {
      const bucket = c.env.PLATFORM_BUCKET;
      if (!bucket) return c.json({ versions: [] });

      const listed = await bucket.list({ prefix: HOTFIX_PREFIX });
      const manifests: HotfixManifest[] = [];
      const seen = new Set<string>();

      for (const object of listed.objects) {
        const relative = object.key.slice(HOTFIX_PREFIX.length);
        const version = relative.split("/")[0];
        if (seen.has(version)) continue;
        const manifest = await readManifest(bucket, version);
        if (manifest) {
          manifests.push(manifest);
          seen.add(version);
        }
      }

      manifests.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
      return c.json({ versions: manifests, latest: await readLatest(bucket) });
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
      return c.json({ success: true, latest: version });
    });

    app.post("/hotfix/rollback/:version", async (c) => {
      const version = c.req.param("version");
      const manifest = await readManifest(c.env.PLATFORM_BUCKET, version);
      if (!manifest) {
        return c.json({ error: "Not found" }, 404);
      }

      await writeLatest(c.env.PLATFORM_BUCKET, version);
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

      return c.json({ success: true });
    });
  },
};
