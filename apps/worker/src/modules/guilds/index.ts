import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

export const guildsManifest: ModuleManifest = {
  id: "guilds",
  name: "Guilds System",
  description: "Guild management and chat via Durable Objects.",
  icon: "ti-users",
};

export const guildsModule: WorkerModule = {
  manifest: guildsManifest,

  init(app: Hono<any>) {
    // Gate every /guilds/* route behind the guilds feature flag
    app.use("/guilds/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "guilds"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "guilds" }, 403);
      }
      await next();
    });

    app.get("/guilds/ws", (c) => {
      const namespace: DurableObjectNamespace | undefined = c.env.GUILD_ROOM;
      if (!namespace) {
        return c.json({ error: "GUILD_ROOM binding is not configured" }, 500);
      }

      const guildId = c.req.query("guildId") || "default";
      const id = namespace.idFromName(guildId);
      const stub = namespace.get(id);

      // Forward the raw request to the GuildRoom DO (it handles WS upgrade)
      return stub.fetch(c.req.raw);
    });

    app.get("/guilds/history", async (c) => {
      const namespace: DurableObjectNamespace | undefined = c.env.GUILD_ROOM;
      if (!namespace) {
        return c.json({ error: "GUILD_ROOM binding is not configured" }, 500);
      }

      const guildId = c.req.query("guildId") || "default";
      const id = namespace.idFromName(guildId);
      const stub = namespace.get(id);

      const historyUrl = new URL(c.req.url);
      historyUrl.pathname = "/history";

      return stub.fetch(new Request(historyUrl.toString(), c.req.raw));
    });

    app.get("/guilds/members", async (c) => {
      const namespace: DurableObjectNamespace | undefined = c.env.GUILD_ROOM;
      if (!namespace) {
        return c.json({ error: "GUILD_ROOM binding is not configured" }, 500);
      }

      const guildId = c.req.query("guildId") || "default";
      const id = namespace.idFromName(guildId);
      const stub = namespace.get(id);

      const url = new URL(c.req.url);
      url.pathname = "/members";

      return stub.fetch(new Request(url.toString(), c.req.raw));
    });

    app.post("/guilds/join", async (c) => {
      const namespace: DurableObjectNamespace | undefined = c.env.GUILD_ROOM;
      if (!namespace) {
        return c.json({ error: "GUILD_ROOM binding is not configured" }, 500);
      }

      const guildId = c.req.query("guildId") || "default";
      const id = namespace.idFromName(guildId);
      const stub = namespace.get(id);

      const url = new URL(c.req.url);
      url.pathname = "/join";

      return stub.fetch(new Request(url.toString(), c.req.raw));
    });

    app.post("/guilds/leave", async (c) => {
      const namespace: DurableObjectNamespace | undefined = c.env.GUILD_ROOM;
      if (!namespace) {
        return c.json({ error: "GUILD_ROOM binding is not configured" }, 500);
      }

      const guildId = c.req.query("guildId") || "default";
      const id = namespace.idFromName(guildId);
      const stub = namespace.get(id);

      const url = new URL(c.req.url);
      url.pathname = "/leave";

      return stub.fetch(new Request(url.toString(), c.req.raw));
    });

    app.post("/guilds/chat", async (c) => {
      const namespace: DurableObjectNamespace | undefined = c.env.GUILD_ROOM;
      if (!namespace) {
        return c.json({ error: "GUILD_ROOM binding is not configured" }, 500);
      }

      const guildId = c.req.query("guildId") || "default";
      const id = namespace.idFromName(guildId);
      const stub = namespace.get(id);

      const url = new URL(c.req.url);
      url.pathname = "/chat";

      return stub.fetch(new Request(url.toString(), c.req.raw));
    });
  },
};
