// Phase 0: Foundation
export * from "./db";
export * from "./error-handler";
export * from "./health";
export * from "./logger";
export * from "./middleware";
export * from "./openapi";
export * from "./room";
export * from "./room-logic";
export * from "./validation";

// Phase 1: Security & Monitoring
export * from "./auth";
export * from "./request-signing";
export * from "./protocol-version";

// Phase 2: Core Features (schema available)
export * from "./schema-extended";

// Phase 3: Advanced Features (core system, simplified)
export * from "./spectator";
