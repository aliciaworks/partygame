import { Hono } from "hono";
import { cors } from "hono/cors";
import { getModuleManifests, mountModules } from "./modules/loader";
import type { PlatformFeatures, PlatformState } from "./platform-state";
import {
  patchPlatformFeatures,
  patchPlatformState,
  readPlatformState,
  getDeprecationWarning,
  isDeprecatedPath,
  isClientVersionCompatible,
} from "./platform-state";
import { verifyAdminSecret } from "./auth-utils";
import { handleForbidden, errorCodeToStatus } from "./error-handler";

type AppEnv = {
  Variables: {
    platformState: PlatformState;
    isAdmin: boolean;
  };
  Bindings: {
    PLATFORM_BUCKET?: R2Bucket;
    ADMIN_SECRET?: string;
  };
};

const app = new Hono<AppEnv>();

const moduleFeatureRequirements: Partial<Record<string, Array<keyof PlatformFeatures>>> = {
  communication: ["textChat", "voiceChat"],
  hotfix: ["gameUpdates"],
  player_progress: ["playerProfile", "leaderboard"],
};

// Middleware: Version negotiation and response header injection
app.use("*", async (c, next) => {
  const platformState = await readPlatformState(c.env.PLATFORM_BUCKET);

  // Check client version compatibility if minClientVersion is set
  const clientVersion = c.req.header("X-Client-Version");
  if (platformState.minClientVersion && clientVersion) {
    if (!isClientVersionCompatible(clientVersion, platformState.minClientVersion)) {
      return c.json(
        {
          error: "CLIENT_VERSION_TOO_OLD",
          message: `Client version ${clientVersion} is no longer supported. Minimum required: ${platformState.minClientVersion}`,
          minClientVersion: platformState.minClientVersion,
        },
        410, // Gone
      );
    }
  }

  // Store platform state in context for later use
  c.set("platformState", platformState);

  // Check admin secret for /admin/* routes
  const isAdminRoute = c.req.path.startsWith("/admin");
  let isAdmin = false;
  if (isAdminRoute) {
    const authHeader = c.req.header("authorization") ?? null;
    if (!verifyAdminSecret(authHeader, c.env.ADMIN_SECRET)) {
      const err = handleForbidden("Admin secret required");
      return c.json(err, { status: errorCodeToStatus(err.error) } as any);
    }
    isAdmin = true;
  }
  c.set("isAdmin", isAdmin);

  await next();

  // Inject version headers into response
  c.header("X-API-Version", platformState.apiVersion);
  
  // Return feature list for client feature detection
  const featureList = Object.entries(platformState.features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .join(",");
  c.header("X-Available-Features", featureList);

  // Check if this endpoint is deprecated
  const path = c.req.path;
  const deprecation = isDeprecatedPath(path, platformState.deprecations);
  if (deprecation) {
    c.header("X-Deprecation-Date", deprecation.removedAt);
    if (deprecation.alternative) {
      c.header("X-Deprecation-Alternative", deprecation.alternative);
    }
    const warning = getDeprecationWarning(deprecation);
    c.header("X-Deprecation-Warning", warning);
  }
});

mountModules(app);

app.use("*", cors({ origin: "*" }));

app.get("/", (c) =>
  c.json({
    name: "PartyGame Worker",
    version: "modular",
    modules: getModuleManifests(),
  }),
);

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

app.get("/admin/modules", async (c) => {
  const state = await readPlatformState(c.env.PLATFORM_BUCKET);

  return c.json({
    modules: getModuleManifests().map((module) => {
      const needs = moduleFeatureRequirements[module.id];
      const enabled =
        !needs || needs.every((featureKey) => state.features[featureKey]);

      return {
        ...module,
        enabled,
      };
    }),
  });
});

app.get("/admin/modules/:id/manifest", (c) => {
  const moduleId = c.req.param("id");
  const module = getModuleManifests().find((entry) => entry.id === moduleId);

  if (!module) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(module);
});

app.get("/api/platform", async (c) =>
  c.json(await readPlatformState(c.env.PLATFORM_BUCKET)),
);

app.get("/admin/platform", async (c) =>
  c.json(await readPlatformState(c.env.PLATFORM_BUCKET)),
);

app.patch("/admin/platform/features", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json(await patchPlatformFeatures(c.env.PLATFORM_BUCKET, body));
});

app.patch("/admin/platform", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return c.json(await patchPlatformState(c.env.PLATFORM_BUCKET, body));
});

export default app;
