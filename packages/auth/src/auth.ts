import { betterAuth } from "better-auth";
import { Hono } from "hono";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthBindings {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  APPLE_CLIENT_ID?: string;
  AUTH_SESSION_SECRET?: string;
}

type NativeProvider = "google" | "apple";

type VerifiedIdentity = {
  userId: string;
  provider: NativeProvider;
  email?: string;
};

type NativeSessionClaims = {
  provider: NativeProvider;
  email?: string;
};

function getSessionSecret(env: AuthBindings) {
  if (!env.AUTH_SESSION_SECRET) {
    throw new Error("Missing AUTH_SESSION_SECRET configuration.");
  }

  return new TextEncoder().encode(env.AUTH_SESSION_SECRET);
}

async function issueNativeSessionToken(
  identity: VerifiedIdentity,
  env: AuthBindings,
) {
  return new SignJWT({
    provider: identity.provider,
    email: identity.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(identity.userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSessionSecret(env));
}

async function verifyNativeSessionToken(
  token: string,
  env: AuthBindings,
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(token, getSessionSecret(env), {
    algorithms: ["HS256"],
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Session token is missing a subject.");
  }

  const sessionClaims = payload as NativeSessionClaims;

  if (
    sessionClaims.provider !== "google" &&
    sessionClaims.provider !== "apple"
  ) {
    throw new Error("Session token is missing a provider.");
  }

  return {
    userId: payload.sub,
    provider: sessionClaims.provider,
    email:
      typeof sessionClaims.email === "string" ? sessionClaims.email : undefined,
  };
}

function getProviderConfig(provider: NativeProvider, env: AuthBindings) {
  if (provider === "google") {
    return {
      audience: env.GOOGLE_CLIENT_ID,
      issuer: "https://accounts.google.com",
      jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    };
  }

  return {
    audience: env.APPLE_CLIENT_ID,
    issuer: "https://appleid.apple.com",
    jwksUrl: "https://appleid.apple.com/auth/keys",
  };
}

async function verifyNativeIdToken(
  provider: NativeProvider,
  idToken: string,
  env: AuthBindings,
): Promise<VerifiedIdentity> {
  const config = getProviderConfig(provider, env);

  if (!config.audience) {
    throw new Error(
      `Missing ${provider.toUpperCase()} client ID configuration.`,
    );
  }

  const { payload } = await jwtVerify(
    idToken,
    createRemoteJWKSet(new URL(config.jwksUrl)),
    {
      audience: config.audience,
      issuer: config.issuer,
      algorithms: ["RS256"],
    },
  );

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Token payload is missing a subject.");
  }

  return {
    userId: `${provider}:${payload.sub}`,
    provider,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

export function createAuth() {
  return betterAuth({
    database: {
      provider: "sqlite",
    },
  });
}

export const authRouter = new Hono<{ Bindings: AuthBindings }>();

authRouter.post("/api/auth/login/native", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    idToken?: unknown;
    provider?: unknown;
  } | null;

  if (
    !body ||
    typeof body.idToken !== "string" ||
    typeof body.provider !== "string"
  ) {
    return c.json(
      { success: false, error: "Missing idToken or provider" },
      400,
    );
  }

  if (body.provider !== "google" && body.provider !== "apple") {
    return c.json({ success: false, error: "Unsupported provider" }, 400);
  }

  try {
    const identity = await verifyNativeIdToken(
      body.provider,
      body.idToken,
      c.env,
    );
    const token = await issueNativeSessionToken(identity, c.env);

    return c.json({
      success: true,
      token,
      provider: identity.provider,
      email: identity.email,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return c.json({ success: false, error: message }, 401);
  }
});

authRouter.post("/api/auth/refresh", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    token?: unknown;
  } | null;

  if (!body || typeof body.token !== "string" || body.token.length === 0) {
    return c.json({ success: false, error: "Missing session token" }, 400);
  }

  try {
    const identity = await verifyNativeSessionToken(body.token, c.env);
    const token = await issueNativeSessionToken(identity, c.env);

    return c.json({
      success: true,
      token,
      provider: identity.provider,
      email: identity.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return c.json({ success: false, error: message }, 401);
  }
});

authRouter.all("/api/auth/*", (c) => {
  const auth = createAuth();
  return auth.handler(c.req.raw);
});
