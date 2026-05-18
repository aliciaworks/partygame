import { betterAuth } from "better-auth";
import { Hono } from "hono";

// Define the Better Auth instance
// This is configured for a Cloudflare D1 environment.
export function createAuth(db: any) {
  return betterAuth({
    database: {
      provider: "sqlite",
      // Connects to the injected D1 database via whatever adapter is chosen
    },
    // We enable session management without relying on cookies automatically
    // by intercepting the session creation.
  });
}

// Create Hono router to intercept auth responses
export const authRouter = new Hono<{ Bindings: { DB: any } }>();

// Custom Game Token Exchange Endpoint
// This handles Task 3: ID Token -> Session Token bypass
authRouter.post("/api/auth/game-login", async (c) => {
  const body = await c.req.json();
  const idToken = body.idToken;
  const provider = body.provider;

  if (!idToken) {
    return c.json({ success: false, error: "Missing idToken" }, 400);
  }

  try {
    const auth = createAuth(c.env.DB);
    
    // 1. Verify the ID token natively.
    // For native games (Unity/Godot), they use mobile SDKs (Sign in with Apple / Google).
    // They receive an ID Token (JWT) and send it to our backend.
    // We would cryptographically verify the JWT here.
    
    // Example of verification (abstracted):
    // const payload = await verifyGoogleIdToken(idToken);
    const verifiedUserId = "user-id-from-token"; 

    // 2. Cookie Bypass & Session Extraction
    // We use Better Auth's programmatic API to create a session.
    // Passing empty headers prevents Better Auth from setting standard HTTP cookies.
    const session = await auth.api.createSession({
      body: {
        userId: verifiedUserId,
      },
      headers: new Headers(), 
    });

    // 3. Return the sessionToken explicitly for the game client
    // The game client stores this string and uses it for the WebSocket handshake.
    return c.json({
      success: true,
      token: session.token,
    });
  } catch (error) {
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
});

// Mount Better Auth's standard handler for web clients if needed
authRouter.all("/api/auth/*", (c) => {
  const auth = createAuth(c.env.DB);
  return auth.handler(c.req.raw);
});
