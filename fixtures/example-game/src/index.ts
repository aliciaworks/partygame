import { Hono } from "hono";
// Import the base GameRoom from the core package
import { GameRoom } from "@partygame/core";
import { authRouter } from "@partygame/auth";

// Export the Durable Object so Cloudflare can bind to it
export { GameRoom };

const app = new Hono<{ Bindings: { DB: any; GAME_ROOM: any } }>();

// Mount the Auth Router
app.route("/", authRouter);

// Basic HTTP endpoint to create or join a room
app.get("/rooms/:id", (c) => {
  const roomId = c.req.param("id");

  // The actual connection logic would upgrade the request to a WebSocket
  // and route it to the GameRoom durable object.
  // Using partyserver's route helper:
  // return routePartykitRequest(c.req.raw, c.env);

  return c.text(`Connect via WS to room ${roomId}`);
});

export default {
  fetch(request: Request, env: any, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
