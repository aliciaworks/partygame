export class MatchmakerRoom implements DurableObject {
  private queue = new Set<string>();
  private allocations = new Map<string, string>(); // playerId -> roomId
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path === "/join") {
      const { playerId } = await request.json() as { playerId: string };
      
      // If already allocated, clear it so they can match again
      this.allocations.delete(playerId);
      this.queue.add(playerId);
      
      this.tryMatch();
      
      return new Response(JSON.stringify({ status: "queued" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "GET" && path === "/status") {
      const playerId = url.searchParams.get("playerId");
      if (!playerId) return new Response("Missing playerId", { status: 400 });

      if (this.allocations.has(playerId)) {
        const roomId = this.allocations.get(playerId);
        // We can optionally delete the allocation after fetching, or let them fetch it multiple times
        return new Response(JSON.stringify({ status: "matched", roomId }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (this.queue.has(playerId)) {
        return new Response(JSON.stringify({ status: "queued" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ status: "none" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "POST" && path === "/leave") {
      const { playerId } = await request.json() as { playerId: string };
      this.queue.delete(playerId);
      this.allocations.delete(playerId);
      return new Response(JSON.stringify({ status: "left" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }

  private tryMatch() {
    // Simple matchmaking: pair every 2 players together
    while (this.queue.size >= 2) {
      const players = Array.from(this.queue).slice(0, 2);
      const roomId = crypto.randomUUID();
      
      for (const p of players) {
        this.queue.delete(p);
        this.allocations.set(p, roomId);
      }
      
      // Keep allocations in memory for a while so clients can poll it
      // A more robust implementation would use Durable Object storage or alarms to clear old allocations
    }
  }
}
