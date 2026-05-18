/**
 * OpenAPI 3.1 specification for PartyGame API.
 * 
 * Usage:
 * 1. Export this as JSON/YAML from your API
 * 2. Use tools like Swagger UI or ReDoc to visualize
 * 3. Generate client SDKs from this spec
 * 
 * Example endpoint registration in Hono:
 *   app.get('/openapi.json', (c) => c.json(OPENAPI_SPEC));
 */

export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "PartyGame API",
    description:
      "Serverless multiplayer game backend framework on Cloudflare Workers",
    version: "0.0.1",
    contact: {
      name: "PartyGame Team",
      url: "https://github.com/aliciaworks/partygame",
    },
    license: {
      name: "MIT",
      url: "https://github.com/aliciaworks/partygame/blob/main/LICENSE",
    },
  },

  servers: [
    {
      url: "http://localhost:8787",
      description: "Local development",
    },
    {
      url: "https://api.partygame.com",
      description: "Production",
    },
  ],

  paths: {
    "/health": {
      get: {
        summary: "Liveness probe",
        description: "Returns 200 if service is healthy and running",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["healthy"] },
                    timestamp: { type: "string", format: "date-time" },
                    uptime_ms: { type: "integer" },
                  },
                  required: ["status", "timestamp", "uptime_ms"],
                },
              },
            },
          },
          "503": {
            description: "Service unhealthy or warming up",
          },
        },
      },
    },

    "/ready": {
      get: {
        summary: "Readiness probe",
        description:
          "Returns 200 only if all dependencies (database, cache, etc) are ready",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Service is ready",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["healthy", "degraded"] },
                    checks: {
                      type: "object",
                      properties: {
                        database: { type: "boolean" },
                        durableObject: { type: "boolean" },
                        cache: { type: "boolean" },
                      },
                    },
                  },
                  required: ["status", "checks"],
                },
              },
            },
          },
          "503": {
            description: "Service not ready",
          },
        },
      },
    },

    "/metrics": {
      get: {
        summary: "Prometheus metrics endpoint",
        description:
          "Exports metrics in Prometheus text format for monitoring and alerting",
        tags: ["Observability"],
        responses: {
          "200": {
            description: "Prometheus metrics",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                  example:
                    '# HELP partygame_uptime_ms Service uptime in milliseconds\npartygame_uptime_ms 12345',
                },
              },
            },
          },
        },
      },
    },

    "/sla": {
      get: {
        summary: "SLA status",
        description: "Current uptime and error rates relative to SLA targets",
        tags: ["Observability"],
        responses: {
          "200": {
            description: "SLA metrics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    period: { type: "string" },
                    uptime_percent: { type: "number" },
                    error_rate_percent: { type: "number" },
                    p99_latency_ms: { type: "number" },
                    sla_target_uptime: { type: "number" },
                    meets_sla: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/auth/login": {
      post: {
        summary: "Authenticate user",
        description: "Login with email/password or OAuth provider",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      email: { type: "string", format: "email" },
                      password: { type: "string" },
                    },
                    required: ["email", "password"],
                  },
                  {
                    type: "object",
                    properties: {
                      provider: {
                        type: "string",
                        enum: ["google", "apple"],
                      },
                      token: { type: "string" },
                    },
                    required: ["provider", "token"],
                  },
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessionToken: { type: "string" },
                    refreshToken: { type: "string" },
                    playerId: { type: "string", format: "uuid" },
                    expiresIn: { type: "integer", description: "Seconds" },
                  },
                  required: ["sessionToken", "playerId", "expiresIn"],
                },
              },
            },
          },
          "400": {
            description: "Invalid credentials or validation error",
          },
          "429": {
            description: "Too many login attempts",
          },
        },
      },
    },

    "/api/auth/refresh": {
      post: {
        summary: "Refresh session token",
        description:
          "Get a new session token using refresh token (no cookie required)",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  refreshToken: { type: "string" },
                },
                required: ["refreshToken"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Token refreshed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessionToken: { type: "string" },
                    expiresIn: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid or expired refresh token",
          },
        },
      },
    },

    "/api/room/join": {
      post: {
        summary: "Join a game room",
        description: "Connect player to game room via WebSocket upgrade or REST",
        tags: ["Room"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  playerId: { type: "string" },
                  roomId: { type: "string" },
                },
                required: ["playerId", "roomId"],
              },
            },
          },
        },
        responses: {
          "101": {
            description:
              "Switching protocols to WebSocket (if Upgrade header present)",
          },
          "200": {
            description: "Room join confirmed, WebSocket endpoint available",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    roomId: { type: "string" },
                    playerId: { type: "string" },
                    activePlayers: { type: "integer" },
                    connectionToken: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid room or player",
          },
          "429": {
            description: "Rate limit exceeded",
          },
        },
      },
    },

    "/api/inventory/purchase": {
      post: {
        summary: "Purchase item",
        description:
          "Buy item from shop with idempotency key for retry safety",
        tags: ["Inventory"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  itemId: { type: "string", format: "uuid" },
                  quantity: { type: "integer", minimum: 1 },
                  playerId: { type: "string" },
                  idempotencyKey: {
                    type: "string",
                    description: "Unique key to prevent double-spending",
                  },
                },
                required: [
                  "itemId",
                  "quantity",
                  "playerId",
                  "idempotencyKey",
                ],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Purchase successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transactionId: { type: "string", format: "uuid" },
                    itemId: { type: "string" },
                    quantity: { type: "integer" },
                    newBalance: { type: "number" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Insufficient balance or invalid item",
          },
          "409": {
            description:
              "Duplicate transaction (same idempotencyKey already processed)",
          },
          "429": {
            description: "Rate limit exceeded",
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },

    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "array", items: { type: "object" } },
          requestId: { type: "string" },
        },
      },

      Player: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          position: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
            },
          },
          lastUpdated: { type: "integer", description: "Unix timestamp" },
        },
      },

      Room: {
        type: "object",
        properties: {
          id: { type: "string" },
          activePlayers: { type: "integer" },
          createdAt: { type: "integer" },
          maxPlayers: { type: "integer" },
          state: { type: "object" },
        },
      },
    },
  },

  tags: [
    {
      name: "Health",
      description: "Service health and readiness checks",
    },
    {
      name: "Observability",
      description: "Metrics and monitoring endpoints",
    },
    {
      name: "Auth",
      description: "Authentication and session management",
    },
    {
      name: "Room",
      description: "Game room lifecycle and operations",
    },
    {
      name: "Inventory",
      description: "Player inventory and transactions",
    },
  ],
};

/**
 * Export OpenAPI spec as JSON for serving via API endpoint.
 */
export function getOpenAPISpec() {
  return OPENAPI_SPEC;
}

/**
 * Convert OpenAPI spec to Markdown documentation.
 */
export function generateMarkdownDocs(): string {
  const spec = OPENAPI_SPEC;
  let markdown = `# ${spec.info.title} Documentation\n\n`;
  markdown += `${spec.info.description}\n\n`;
  markdown += `**Version**: ${spec.info.version}\n\n`;

  markdown += `## Endpoints\n\n`;

  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      markdown += `### ${method.toUpperCase()} ${path}\n\n`;
      markdown += `${operation.summary}\n\n`;
      if (operation.description) {
        markdown += `${operation.description}\n\n`;
      }
      markdown += "---\n\n";
    }
  }

  return markdown;
}
