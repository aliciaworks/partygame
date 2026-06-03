import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

export const chatManifest: ModuleManifest = {
  id: "chat",
  name: "Text Chat",
  description: "Real-time text chat using WebSocket Durable Objects.",
  icon: "ti-message",
};

export const chatModule: WorkerModule = {
  manifest: chatManifest,

  init(app: Hono<any>) {
    // Gate every /chat/* route behind the textChat feature flag
    app.use("/chat/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "textChat"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "textChat" }, 403);
      }
      await next();
    });

    /**
     * GET /chat/ws?roomId=<id>&playerId=<id>&playerName=<name>
     * Upgrades the connection to a WebSocket and routes it to the ChatRoom
     * Durable Object identified by roomId.
     */
    app.get("/chat/ws", (c) => {
      const namespace: DurableObjectNamespace | undefined = (c.env as any).CHAT_ROOM;
      if (!namespace) {
        return c.json({ error: "CHAT_ROOM binding is not configured" }, 500);
      }

      const roomId = c.req.query("roomId") || "global";
      const id = namespace.idFromName(roomId);
      const stub = namespace.get(id);

      // Forward the raw request to the ChatRoom DO (it handles WS upgrade)
      return stub.fetch(c.req.raw);
    });

    /**
     * GET /chat/history?roomId=<id>
     * Retrieves the last 50 persisted messages from a ChatRoom instance.
     */
    app.get("/chat/history", async (c) => {
      const namespace: DurableObjectNamespace | undefined = (c.env as any).CHAT_ROOM;
      if (!namespace) {
        return c.json({ error: "CHAT_ROOM binding is not configured" }, 500);
      }

      const roomId = c.req.query("roomId") || "global";
      const id = namespace.idFromName(roomId);
      const stub = namespace.get(id);

      // Build an internal HTTP request for the /history path
      const historyUrl = new URL(c.req.url);
      historyUrl.pathname = "/history";

      const resp = await stub.fetch(new Request(historyUrl.toString()));
      const history = await resp.json();
      return c.json({ history });
    });
  },
};
