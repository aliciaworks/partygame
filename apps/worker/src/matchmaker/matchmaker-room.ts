/** MatchmakerRoom Durable Object
 *
 * Persists queue and allocations via DurableObject storage so that data
 * survives restarts. An alarm fires every 5 minutes to purge stale entries.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueEntry {
  playerId: string;
  gameType: string;
  joinedAt: number;
}

interface AllocationEntry {
  roomId: string;
  gameType: string;
  allocatedAt: number;
}

// Storage shapes
type QueueStore = QueueEntry[];
type AllocationsStore = Record<string, AllocationEntry>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_KEY = "queue";
const ALLOCATIONS_KEY = "allocations";

/** Max age for a queued player before the alarm removes them (2 minutes). */
const QUEUE_TTL_MS = 2 * 60 * 1000;

/** Max age for an allocation before the alarm removes it (5 minutes). */
const ALLOCATION_TTL_MS = 5 * 60 * 1000;

/** How far in the future to schedule the cleanup alarm (5 minutes). */
const ALARM_DELAY_MS = 5 * 60 * 1000;

/** Minimum number of players required to form a match per gameType. */
const MATCH_SIZE = 2;

// ---------------------------------------------------------------------------
// MatchmakerRoom
// ---------------------------------------------------------------------------

export class MatchmakerRoom implements DurableObject {
  constructor(private state: DurableObjectState, private env: any) {}

  // -------------------------------------------------------------------------
  // Storage helpers
  // -------------------------------------------------------------------------

  /** Load the current queue from persistent storage. */
  private async loadQueue(): Promise<QueueEntry[]> {
    const stored = await this.state.storage.get<QueueStore>(QUEUE_KEY);
    return stored ?? [];
  }

  /** Load the current allocations from persistent storage. */
  private async loadAllocations(): Promise<Map<string, AllocationEntry>> {
    const stored = await this.state.storage.get<AllocationsStore>(ALLOCATIONS_KEY);
    if (!stored) return new Map();
    return new Map(Object.entries(stored));
  }

  /** Persist the queue to storage. */
  private async saveQueue(queue: QueueEntry[]): Promise<void> {
    await this.state.storage.put(QUEUE_KEY, queue);
  }

  /** Persist the allocations map to storage. */
  private async saveAllocations(allocations: Map<string, AllocationEntry>): Promise<void> {
    await this.state.storage.put(
      ALLOCATIONS_KEY,
      Object.fromEntries(allocations),
    );
  }

  // -------------------------------------------------------------------------
  // Alarm (cleanup)
  // -------------------------------------------------------------------------

  /** Called by the Workers runtime when the alarm fires. */
  async alarm(): Promise<void> {
    const now = Date.now();

    // --- Clean up the queue ---
    let queue = await this.loadQueue();
    const queueSizeBefore = queue.length;
    queue = queue.filter((entry) => now - entry.joinedAt < QUEUE_TTL_MS);
    if (queue.length !== queueSizeBefore) {
      await this.saveQueue(queue);
    }

    // --- Clean up allocations ---
    const allocations = await this.loadAllocations();
    let allocationsDirty = false;
    for (const [playerId, entry] of allocations) {
      if (now - entry.allocatedAt >= ALLOCATION_TTL_MS) {
        allocations.delete(playerId);
        allocationsDirty = true;
      }
    }
    if (allocationsDirty) {
      await this.saveAllocations(allocations);
    }
  }

  // -------------------------------------------------------------------------
  // Matchmaking logic
  // -------------------------------------------------------------------------

  /**
   * Groups queued players by gameType and pairs them up when enough players
   * are waiting for the same game type. Returns an updated queue and
   * allocations map.
   */
  private tryMatch(
    queue: QueueEntry[],
    allocations: Map<string, AllocationEntry>,
  ): { queue: QueueEntry[]; allocations: Map<string, AllocationEntry> } {
    // Group queue entries by gameType
    const byGameType = new Map<string, QueueEntry[]>();
    for (const entry of queue) {
      const bucket = byGameType.get(entry.gameType) ?? [];
      bucket.push(entry);
      byGameType.set(entry.gameType, bucket);
    }

    const matchedPlayerIds = new Set<string>();

    for (const [gameType, players] of byGameType) {
      // Process as many complete groups as possible
      while (players.length >= MATCH_SIZE) {
        const group = players.splice(0, MATCH_SIZE);
        const roomId = crypto.randomUUID();
        const allocatedAt = Date.now();

        for (const player of group) {
          matchedPlayerIds.add(player.playerId);
          allocations.set(player.playerId, { roomId, gameType, allocatedAt });
        }
      }
    }

    // Remove matched players from the queue
    const updatedQueue = queue.filter(
      (entry) => !matchedPlayerIds.has(entry.playerId),
    );

    return { queue: updatedQueue, allocations };
  }

  // -------------------------------------------------------------------------
  // Request handler
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /join – add a player to the matchmaking queue
    if (request.method === "POST" && path === "/join") {
      const body = (await request.json()) as { playerId: string; gameType?: string };
      const { playerId } = body;
      const gameType = body.gameType ?? "moba";

      if (!playerId) {
        return new Response(JSON.stringify({ error: "Missing playerId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let queue = await this.loadQueue();
      let allocations = await this.loadAllocations();

      // Clear any previous allocation so the player can re-queue
      allocations.delete(playerId);

      // Remove any existing queue entry for this player before re-adding
      queue = queue.filter((e) => e.playerId !== playerId);
      queue.push({ playerId, gameType, joinedAt: Date.now() });

      // Attempt to match players before saving
      ({ queue, allocations } = this.tryMatch(queue, allocations));

      await this.saveQueue(queue);
      await this.saveAllocations(allocations);

      // Schedule a cleanup alarm so stale entries don't linger forever.
      // Cast to any because setAlarm() is valid at runtime on DO storage
      // but may not appear in older @cloudflare/workers-types builds.
      await (this.state as any).setAlarm(Date.now() + ALARM_DELAY_MS);

      return new Response(JSON.stringify({ status: "queued" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /status?playerId=<id> – poll match result
    if (request.method === "GET" && path === "/status") {
      const playerId = url.searchParams.get("playerId");
      if (!playerId) {
        return new Response(JSON.stringify({ error: "Missing playerId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const allocations = await this.loadAllocations();

      if (allocations.has(playerId)) {
        const { roomId, gameType } = allocations.get(playerId)!;
        return new Response(
          JSON.stringify({ status: "matched", roomId, gameType }),
          { headers: { "Content-Type": "application/json" } },
        );
      }

      const queue = await this.loadQueue();
      const inQueue = queue.some((e) => e.playerId === playerId);

      return new Response(
        JSON.stringify({ status: inQueue ? "queued" : "none" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // POST /leave – remove a player from the queue and clear their allocation
    if (request.method === "POST" && path === "/leave") {
      const body = (await request.json()) as { playerId: string };
      const { playerId } = body;

      if (!playerId) {
        return new Response(JSON.stringify({ error: "Missing playerId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let queue = await this.loadQueue();
      const allocations = await this.loadAllocations();

      queue = queue.filter((e) => e.playerId !== playerId);
      allocations.delete(playerId);

      await this.saveQueue(queue);
      await this.saveAllocations(allocations);

      return new Response(JSON.stringify({ status: "left" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
