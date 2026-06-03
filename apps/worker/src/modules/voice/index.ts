import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

// Base URL for the Cloudflare Calls REST API
const CF_CALLS_BASE = "https://rtc.live.cloudflare.com/v1/apps";

/**
 * Build the Authorization header value for Cloudflare Calls API requests.
 */
function callsAuthHeader(appSecret: string): string {
  return `Bearer ${appSecret}`;
}

/**
 * Resolve and validate the Cloudflare Calls credentials from the environment.
 * Returns null when either credential is absent (caller should return 501).
 */
function resolveCallsCredentials(
  env: any,
): { appId: string; appSecret: string } | null {
  const appId: string | undefined = env.CALLS_APP_ID;
  const appSecret: string | undefined = env.CALLS_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export const voiceManifest: ModuleManifest = {
  id: "voice",
  name: "Voice Chat",
  description: "Real-time voice using Cloudflare Calls SFU.",
  icon: "ti-microphone",
};

export const voiceModule: WorkerModule = {
  manifest: voiceManifest,

  init(app: Hono<any>) {
    // Gate every /voice/* route behind the voiceChat feature flag
    app.use("/voice/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "voiceChat"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "voiceChat" }, 403);
      }
      await next();
    });

    /**
     * POST /voice/session
     * Create a new Cloudflare Calls session for a player joining a voice room.
     *
     * Request body: { playerId: string, roomId: string }
     * Response:     { sessionId: string, sessionToken: string }
     */
    app.post("/voice/session", async (c) => {
      const creds = resolveCallsCredentials(c.env as any);
      if (!creds) {
        // Calls credentials not configured – tell the client the feature is unavailable
        return c.json({ error: "VOICE_NOT_CONFIGURED" }, 501);
      }

      const body = await c.req.json().catch(() => ({})) as {
        playerId?: string;
        roomId?: string;
      };

      if (!body.playerId || !body.roomId) {
        return c.json({ error: "playerId and roomId are required" }, 400);
      }

      // Call Cloudflare Calls: create a new session
      const cfRes = await fetch(
        `${CF_CALLS_BASE}/${creds.appId}/sessions/new`,
        {
          method: "POST",
          headers: {
            Authorization: callsAuthHeader(creds.appSecret),
            "Content-Type": "application/json",
          },
        },
      );

      if (!cfRes.ok) {
        const errorText = await cfRes.text().catch(() => "");
        return c.json(
          { error: "CF_CALLS_ERROR", status: cfRes.status, detail: errorText },
          502,
        );
      }

      const cfData = (await cfRes.json()) as {
        sessionId?: string;
        sessionToken?: string;
        [key: string]: unknown;
      };

      return c.json({
        sessionId: cfData.sessionId,
        sessionToken: cfData.sessionToken,
      });
    });

    /**
     * POST /voice/tracks
     * Publish (send) or subscribe to (receive) tracks within an existing session.
     * The `tracks` array is passed through directly to the Cloudflare Calls API.
     *
     * Request body: { sessionId: string, tracks: any[] }
     */
    app.post("/voice/tracks", async (c) => {
      const creds = resolveCallsCredentials(c.env as any);
      if (!creds) {
        return c.json({ error: "VOICE_NOT_CONFIGURED" }, 501);
      }

      const body = await c.req.json().catch(() => ({})) as {
        sessionId?: string;
        tracks?: unknown[];
      };

      if (!body.sessionId) {
        return c.json({ error: "sessionId is required" }, 400);
      }

      if (!Array.isArray(body.tracks) || body.tracks.length === 0) {
        return c.json({ error: "tracks must be a non-empty array" }, 400);
      }

      // Forward the tracks payload to Cloudflare Calls
      const cfRes = await fetch(
        `${CF_CALLS_BASE}/${creds.appId}/sessions/${body.sessionId}/tracks/new`,
        {
          method: "POST",
          headers: {
            Authorization: callsAuthHeader(creds.appSecret),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tracks: body.tracks }),
        },
      );

      if (!cfRes.ok) {
        const errorText = await cfRes.text().catch(() => "");
        return c.json(
          { error: "CF_CALLS_ERROR", status: cfRes.status, detail: errorText },
          502,
        );
      }

      // Return the Cloudflare Calls response as-is
      const cfData = await cfRes.json();
      return c.json(cfData);
    });

    /**
     * DELETE /voice/session/:sessionId
     * Close an existing Cloudflare Calls session and release its resources.
     *
     * Response: { success: true }
     */
    app.delete("/voice/session/:sessionId", async (c) => {
      const creds = resolveCallsCredentials(c.env as any);
      if (!creds) {
        return c.json({ error: "VOICE_NOT_CONFIGURED" }, 501);
      }

      const sessionId = c.req.param("sessionId");

      const cfRes = await fetch(
        `${CF_CALLS_BASE}/${creds.appId}/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: callsAuthHeader(creds.appSecret),
          },
        },
      );

      if (!cfRes.ok) {
        const errorText = await cfRes.text().catch(() => "");
        return c.json(
          { error: "CF_CALLS_ERROR", status: cfRes.status, detail: errorText },
          502,
        );
      }

      return c.json({ success: true });
    });
  },
};
