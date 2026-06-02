import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

export const matchmakingManifest: ModuleManifest = {
  id: "matchmaking",
  name: "Matchmaking",
  description: "Queues players and assigns them to game instances.",
  icon: "ti-arrows-join",
};

async function proxyMatchmakerRequest(c: any, path: string, method: string, body?: any): Promise<Response> {
  const namespace = c.env.MATCHMAKER_ROOM as DurableObjectNamespace | undefined;
  if (!namespace) {
    return c.json({ error: "MATCHMAKER_ROOM binding missing" }, 500);
  }
  
  // We use a single global matchmaker instance for simplicity
  const id = namespace.idFromName("global-matchmaker");
  const stub = namespace.get(id);
  
  const url = `https://matchmaker.internal${path}`;
  return stub.fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const matchmakingModule: WorkerModule = {
  manifest: matchmakingManifest,
  init(app: Hono<any>) {
    app.use("/matchmaking/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "matchmaking"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "matchmaking" }, 403);
      }
      await next();
    });

    app.post("/matchmaking/join", async (c) => {
      const body = await c.req.json().catch(() => ({}));
      if (!body.playerId) {
        return c.json({ error: "playerId is required" }, 400);
      }
      return proxyMatchmakerRequest(c, "/join", "POST", { playerId: body.playerId });
    });

    app.get("/matchmaking/status", async (c) => {
      const playerId = c.req.query("playerId");
      if (!playerId) {
        return c.json({ error: "playerId is required" }, 400);
      }
      return proxyMatchmakerRequest(c, `/status?playerId=${encodeURIComponent(playerId)}`, "GET");
    });

    app.post("/matchmaking/leave", async (c) => {
      const body = await c.req.json().catch(() => ({}));
      if (!body.playerId) {
        return c.json({ error: "playerId is required" }, 400);
      }
      return proxyMatchmakerRequest(c, "/leave", "POST", { playerId: body.playerId });
    });
  },
};
