const PROFILE_PREFIX = "players/";
const FRIENDS_SUFFIX = "/friends.json";
const LEADERBOARD_PREFIX = "leaderboards/";

export interface PlayerProfile {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  updatedAt: string;
}

export interface FriendsList {
  playerId: string;
  friends: string[];
  updatedAt: string;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  score: number;
  updatedAt: string;
}

export interface LeaderboardBoard {
  boardId: string;
  entries: LeaderboardEntry[];
  updatedAt: string;
}

const memoryProfiles = new Map<string, PlayerProfile>();
const memoryFriends = new Map<string, FriendsList>();
const memoryBoards = new Map<string, LeaderboardBoard>();

function profileKey(playerId: string): string {
  return `${PROFILE_PREFIX}${playerId}/profile.json`;
}

function friendsKey(playerId: string): string {
  return `${PROFILE_PREFIX}${playerId}${FRIENDS_SUFFIX}`;
}

function boardKey(boardId: string): string {
  return `${LEADERBOARD_PREFIX}${boardId}.json`;
}

export async function getPlayerProfile(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<PlayerProfile> {
  const fallback: PlayerProfile = {
    playerId,
    displayName: "Player",
    avatarUrl: null,
    level: 1,
    updatedAt: new Date().toISOString(),
  };

  if (!bucket) {
    return memoryProfiles.get(playerId) ?? fallback;
  }

  const object = await bucket.get(profileKey(playerId));
  if (!object) return fallback;

  try {
    const parsed = JSON.parse(await object.text()) as Partial<PlayerProfile>;
    return {
      playerId,
      displayName:
        typeof parsed.displayName === "string"
          ? parsed.displayName
          : fallback.displayName,
      avatarUrl:
        typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : null,
      level: typeof parsed.level === "number" ? parsed.level : 1,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

export async function savePlayerProfile(
  bucket: R2Bucket | undefined,
  playerId: string,
  patch: Partial<Pick<PlayerProfile, "displayName" | "avatarUrl" | "level">>,
): Promise<PlayerProfile> {
  const current = await getPlayerProfile(bucket, playerId);
  const next: PlayerProfile = {
    ...current,
    displayName:
      typeof patch.displayName === "string"
        ? patch.displayName.trim() || current.displayName
        : current.displayName,
    avatarUrl:
      patch.avatarUrl === null || typeof patch.avatarUrl === "string"
        ? (patch.avatarUrl ?? current.avatarUrl)
        : current.avatarUrl,
    level:
      typeof patch.level === "number" && patch.level > 0
        ? Math.floor(patch.level)
        : current.level,
    updatedAt: new Date().toISOString(),
  };

  memoryProfiles.set(playerId, next);

  if (bucket) {
    await bucket.put(profileKey(playerId), JSON.stringify(next, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return next;
}

export async function getFriendsList(
  bucket: R2Bucket | undefined,
  playerId: string,
): Promise<FriendsList> {
  const empty: FriendsList = {
    playerId,
    friends: [],
    updatedAt: new Date().toISOString(),
  };

  if (!bucket) {
    return memoryFriends.get(playerId) ?? empty;
  }

  const object = await bucket.get(friendsKey(playerId));
  if (!object) return empty;

  try {
    const parsed = JSON.parse(await object.text()) as Partial<FriendsList>;
    const friends = Array.isArray(parsed.friends)
      ? parsed.friends.filter((id): id is string => typeof id === "string")
      : [];
    return {
      playerId,
      friends: [...new Set(friends)],
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return empty;
  }
}

export async function addFriend(
  bucket: R2Bucket | undefined,
  playerId: string,
  friendId: string,
): Promise<FriendsList> {
  if (playerId === friendId) {
    throw new Error("Cannot add yourself");
  }

  const list = await getFriendsList(bucket, playerId);
  if (!list.friends.includes(friendId)) {
    list.friends.push(friendId);
  }
  list.updatedAt = new Date().toISOString();

  memoryFriends.set(playerId, list);

  if (bucket) {
    await bucket.put(friendsKey(playerId), JSON.stringify(list, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  const reverse = await getFriendsList(bucket, friendId);
  if (!reverse.friends.includes(playerId)) {
    reverse.friends.push(playerId);
    reverse.updatedAt = new Date().toISOString();
    memoryFriends.set(friendId, reverse);
    if (bucket) {
      await bucket.put(friendsKey(friendId), JSON.stringify(reverse, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });
    }
  }

  return list;
}

export async function removeFriend(
  bucket: R2Bucket | undefined,
  playerId: string,
  friendId: string,
): Promise<FriendsList> {
  const list = await getFriendsList(bucket, playerId);
  list.friends = list.friends.filter((id) => id !== friendId);
  list.updatedAt = new Date().toISOString();
  memoryFriends.set(playerId, list);

  if (bucket) {
    await bucket.put(friendsKey(playerId), JSON.stringify(list, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  const reverse = await getFriendsList(bucket, friendId);
  reverse.friends = reverse.friends.filter((id) => id !== playerId);
  reverse.updatedAt = new Date().toISOString();
  memoryFriends.set(friendId, reverse);
  if (bucket) {
    await bucket.put(friendsKey(friendId), JSON.stringify(reverse, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return list;
}

export async function getLeaderboard(
  bucket: R2Bucket | undefined,
  boardId: string,
  limit = 50,
): Promise<LeaderboardBoard> {
  const empty: LeaderboardBoard = {
    boardId,
    entries: [],
    updatedAt: new Date().toISOString(),
  };

  if (!bucket) {
    const board = memoryBoards.get(boardId);
    if (!board) return empty;
    return {
      ...board,
      entries: board.entries.slice(0, limit),
    };
  }

  const object = await bucket.get(boardKey(boardId));
  if (!object) return empty;

  try {
    const parsed = JSON.parse(await object.text()) as Partial<LeaderboardBoard>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .filter(
            (e): e is LeaderboardEntry =>
              !!e &&
              typeof e.playerId === "string" &&
              typeof e.score === "number",
          )
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
      : [];
    return {
      boardId,
      entries,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return empty;
  }
}

export async function submitLeaderboardScore(
  bucket: R2Bucket | undefined,
  boardId: string,
  entry: { playerId: string; displayName: string; score: number },
): Promise<LeaderboardBoard> {
  const board = await getLeaderboard(bucket, boardId, 500);
  const nextEntry: LeaderboardEntry = {
    playerId: entry.playerId,
    displayName: entry.displayName.trim() || "Player",
    score: entry.score,
    updatedAt: new Date().toISOString(),
  };

  const existing = board.entries.findIndex((e) => e.playerId === entry.playerId);
  if (existing >= 0) {
    if (nextEntry.score > board.entries[existing].score) {
      board.entries[existing] = nextEntry;
    }
  } else {
    board.entries.push(nextEntry);
  }

  board.entries.sort((a, b) => b.score - a.score);
  board.entries = board.entries.slice(0, 100);
  board.updatedAt = new Date().toISOString();

  memoryBoards.set(boardId, board);

  if (bucket) {
    await bucket.put(boardKey(boardId), JSON.stringify(board, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return getLeaderboard(bucket, boardId, 50);
}
