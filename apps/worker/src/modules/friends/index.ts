import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";

// Shape of a single friend entry stored in friends.json
type FriendEntry = {
  friendId: string;
  addedAt: string;
  status: "pending" | "accepted" | "blocked";
};

// R2 key for a player's friends list
function friendsKey(playerId: string): string {
  return `players/${playerId}/friends.json`;
}

/**
 * Read a player's friends list from R2.
 * Returns an empty array when the bucket is unavailable or the key does not exist.
 */
async function readFriends(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<FriendEntry[]> {
  if (!bucket) return [];

  const object = await bucket.get(friendsKey(playerId));
  if (!object) return [];

  try {
    const parsed = JSON.parse(await object.text());
    return Array.isArray(parsed) ? (parsed as FriendEntry[]) : [];
  } catch {
    // Corrupt data — treat as empty list
    return [];
  }
}

/**
 * Persist a player's friends list to R2.
 * No-op when the bucket is unavailable.
 */
async function writeFriends(
  bucket: R2Bucket | undefined,
  playerId: string,
  entries: FriendEntry[],
): Promise<void> {
  if (!bucket) return;

  await bucket.put(friendsKey(playerId), JSON.stringify(entries, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

/**
 * Find the index of a friend entry by friendId.
 * Returns -1 when not found.
 */
function findEntryIndex(entries: FriendEntry[], friendId: string): number {
  return entries.findIndex((e) => e.friendId === friendId);
}

// ──────────────────────────────────────────────────────────────────────────────
// Module manifest
// ──────────────────────────────────────────────────────────────────────────────

export const friendsManifest: ModuleManifest = {
  id: "friends",
  name: "Friends",
  description: "Friend requests, social graph, and block list.",
  icon: "ti-users",
};

// ──────────────────────────────────────────────────────────────────────────────
// Module definition
// ──────────────────────────────────────────────────────────────────────────────

export const friendsModule: WorkerModule = {
  manifest: friendsManifest,

  init(app: Hono<any>) {
    // Guard: reject all /friends/* requests when the feature is disabled
    app.use("/friends/*", async (c, next) => {
      if (!(await isFeatureEnabled(c.env.PLATFORM_BUCKET, "friends"))) {
        return c.json({ error: "FEATURE_DISABLED", feature: "friends" }, 403);
      }
      await next();
    });

    // GET /friends?playerId=<id>
    // Returns the full friends list for the given player.
    app.get("/friends", async (c) => {
      const playerId = c.req.query("playerId");
      if (!playerId) {
        return c.json({ error: "playerId query parameter is required" }, 400);
      }

      const friends = await readFriends(c.env.PLATFORM_BUCKET, playerId);
      return c.json({ playerId, friends });
    });

    // POST /friends/request
    // Body: { fromPlayerId, toPlayerId }
    // Creates a pending entry on the recipient's list and an outgoing entry on the sender's list.
    app.post("/friends/request", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        fromPlayerId?: string;
        toPlayerId?: string;
      };

      const { fromPlayerId, toPlayerId } = body;
      if (!fromPlayerId || !toPlayerId) {
        return c.json({ error: "fromPlayerId and toPlayerId are required" }, 400);
      }
      if (fromPlayerId === toPlayerId) {
        return c.json({ error: "Cannot send a friend request to yourself" }, 400);
      }

      const bucket = c.env.PLATFORM_BUCKET;
      const now = new Date().toISOString();

      // Update sender's list: add a pending outgoing entry (or skip if already present)
      const senderList = await readFriends(bucket, fromPlayerId);
      const senderIdx = findEntryIndex(senderList, toPlayerId);
      if (senderIdx === -1) {
        senderList.push({ friendId: toPlayerId, addedAt: now, status: "pending" });
        await writeFriends(bucket, fromPlayerId, senderList);
      }

      // Update recipient's list: add a pending incoming entry (or skip if already present)
      const recipientList = await readFriends(bucket, toPlayerId);
      const recipientIdx = findEntryIndex(recipientList, fromPlayerId);
      if (recipientIdx === -1) {
        recipientList.push({ friendId: fromPlayerId, addedAt: now, status: "pending" });
        await writeFriends(bucket, toPlayerId, recipientList);
      }

      return c.json({ success: true });
    });

    // POST /friends/accept
    // Body: { playerId, friendId }
    // Marks the relationship as accepted on both sides.
    app.post("/friends/accept", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        playerId?: string;
        friendId?: string;
      };

      const { playerId, friendId } = body;
      if (!playerId || !friendId) {
        return c.json({ error: "playerId and friendId are required" }, 400);
      }

      const bucket = c.env.PLATFORM_BUCKET;
      const now = new Date().toISOString();

      // Update accepting player's list
      const playerList = await readFriends(bucket, playerId);
      const playerIdx = findEntryIndex(playerList, friendId);
      if (playerIdx === -1) {
        // No pending request found; create an accepted entry
        playerList.push({ friendId, addedAt: now, status: "accepted" });
      } else {
        playerList[playerIdx] = { ...playerList[playerIdx], status: "accepted" };
      }
      await writeFriends(bucket, playerId, playerList);

      // Mirror the acceptance on the other player's list
      const friendList = await readFriends(bucket, friendId);
      const friendIdx = findEntryIndex(friendList, playerId);
      if (friendIdx === -1) {
        friendList.push({ friendId: playerId, addedAt: now, status: "accepted" });
      } else {
        friendList[friendIdx] = { ...friendList[friendIdx], status: "accepted" };
      }
      await writeFriends(bucket, friendId, friendList);

      return c.json({ success: true });
    });

    // POST /friends/decline
    // Body: { playerId, friendId }
    // Removes the relationship entry from both sides (decline or unfriend).
    app.post("/friends/decline", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        playerId?: string;
        friendId?: string;
      };

      const { playerId, friendId } = body;
      if (!playerId || !friendId) {
        return c.json({ error: "playerId and friendId are required" }, 400);
      }

      const bucket = c.env.PLATFORM_BUCKET;

      // Remove entry from the acting player's list
      const playerList = await readFriends(bucket, playerId);
      const filteredPlayer = playerList.filter((e) => e.friendId !== friendId);
      await writeFriends(bucket, playerId, filteredPlayer);

      // Remove the mirrored entry from the other player's list
      const friendList = await readFriends(bucket, friendId);
      const filteredFriend = friendList.filter((e) => e.friendId !== playerId);
      await writeFriends(bucket, friendId, filteredFriend);

      return c.json({ success: true });
    });

    // POST /friends/block
    // Body: { playerId, friendId }
    // Sets the entry to 'blocked' on the acting player's side and removes the
    // reverse entry on the blocked player's side so they can no longer see the
    // relationship.
    app.post("/friends/block", async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        playerId?: string;
        friendId?: string;
      };

      const { playerId, friendId } = body;
      if (!playerId || !friendId) {
        return c.json({ error: "playerId and friendId are required" }, 400);
      }
      if (playerId === friendId) {
        return c.json({ error: "Cannot block yourself" }, 400);
      }

      const bucket = c.env.PLATFORM_BUCKET;
      const now = new Date().toISOString();

      // Upsert a blocked entry on the acting player's list
      const playerList = await readFriends(bucket, playerId);
      const playerIdx = findEntryIndex(playerList, friendId);
      if (playerIdx === -1) {
        playerList.push({ friendId, addedAt: now, status: "blocked" });
      } else {
        playerList[playerIdx] = { ...playerList[playerIdx], status: "blocked" };
      }
      await writeFriends(bucket, playerId, playerList);

      // Remove any entry the blocked player has for the acting player so the
      // block is transparent to the blocked party
      const blockedList = await readFriends(bucket, friendId);
      const filteredBlocked = blockedList.filter((e) => e.friendId !== playerId);
      await writeFriends(bucket, friendId, filteredBlocked);

      return c.json({ success: true });
    });
  },
};
