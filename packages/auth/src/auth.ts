import { betterAuth } from "better-auth";
import { Hono } from "hono";

export function createAuth(db: any) {
  return betterAuth({
    database: {
      provider: "sqlite",
    },
  });
}

export const authRouter = new Hono<{ Bindings: { DB: any } }>();

// Task 3: Game Identity & Stateless Token Flow (Better Auth + Hono Integration)
authRouter.post("/api/auth/login/native", async (c) => {
  const body = await c.req.json();
  const idToken = body.idToken;
  const provider = body.provider; // "google" or "apple"

  if (!idToken || !provider) {
    return c.json({ success: false, error: "Missing idToken or provider" }, 400);
  }

  try {
    const auth = createAuth(c.env.DB);
    
    // 1. Native ID Token Endpoint
    // We use Better Auth's programmatic verification API.
    // In a real environment, this might be a plugin or custom credential verification
    // Here we simulate validating the token and creating the session without OAuth web redirects.
    let userId: string;
    if (provider === "google") {
      // Validate Google ID Token via provider APIs or Better Auth plugin
      userId = "google-verified-user-id";
    } else if (provider === "apple") {
      userId = "apple-verified-user-id";
    } else {
      return c.json({ success: false, error: "Unsupported provider" }, 400);
    }

    // 2. Cookie Bypass Middleware
    // Use Better Auth to programmatically create the session for the verified user.
    // By invoking createSession internally and passing empty headers or extracting the token,
    // we bypass the standard browser Set-Cookie response and instead capture the raw token.
    const session = await auth.api.createSession({
      body: {
        userId,
      },
      headers: new Headers(), // Prevents standard cookie emission internally
    });

    // 3. Return the stateless sessionToken directly to the native game client
    return c.json({
      success: true,
      token: session.token,
    });
  } catch (error) {
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
});

// Refresh Token Bridge
// Games don't have cookies, so when the session token expires, they send it
// back here (or a separate refresh token) to get a new session.
authRouter.post("/api/auth/refresh", async (c) => {
  const body = await c.req.json();
  const oldToken = body.token;

  if (!oldToken) {
    return c.json({ success: false, error: "Missing session token" }, 400);
  }

  try {
    const auth = createAuth(c.env.DB);
    // 1. Verify the old session manually
    // In Better Auth, you would typically validate it using their internal API
    // and if valid/expired-but-refreshable, issue a new one.
    // For this example, we assume we extract the userId from it and create a new one.
    
    // Simulate verification
    const userId = "extracted-user-id"; // This would come from auth.api.getSession() or similar
    
    // 2. Issue new session without cookies
    const newSession = await auth.api.createSession({
      body: { userId },
      headers: new Headers(), // Cookie bypass
    });

    return c.json({
      success: true,
      token: newSession.token,
    });
  } catch (error) {
    return c.json({ success: false, error: "Refresh failed" }, 401);
  }
});

// Standard Better Auth handler for web interfaces (fallback)
authRouter.all("/api/auth/*", (c) => {
  const auth = createAuth(c.env.DB);
  return auth.handler(c.req.raw);
});
