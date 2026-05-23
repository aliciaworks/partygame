import { Hono } from "hono";
import { cors } from "hono/cors";
import { getModuleManifests, mountModules } from "./modules/loader";

const app = new Hono();

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

app.get("/admin/modules", (c) =>
  c.json({
    modules: getModuleManifests().map((module) => ({
      ...module,
      enabled: true,
    })),
  }),
);

app.get("/admin/modules/:id/manifest", (c) => {
  const moduleId = c.req.param("id");
  const module = getModuleManifests().find((entry) => entry.id === moduleId);

  if (!module) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(module);
});

export default app;
