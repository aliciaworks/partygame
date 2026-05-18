import { drizzle } from "drizzle-orm/d1";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq, and, gte, sql } from "drizzle-orm";

// --- Schema Definitions ---

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  balance: integer("balance").notNull().default(0),
});

export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  itemId: text("item_id").notNull(),
});

// --- Game Database Logic ---

/**
 * Purchases an item for a player, deducting the cost from their balance
 * and adding the item to their inventory.
 * 
 * Uses an atomic decrement to completely prevent race conditions and 
 * negative balances, even under heavy concurrent requests.
 */
export async function purchaseItem(
  d1db: D1Database,
  playerId: string,
  itemId: string,
  cost: number
): Promise<{ success: boolean; message: string }> {
  const db = drizzle(d1db);

  try {
    // We use D1 strict transactions via Drizzle
    const success = await db.transaction(async (tx) => {
      // 1. Atomic Balance Deduction
      // Instead of SELECTing the balance, checking it in JS, and then UPDATEing
      // (which creates a race condition window), we do an atomic UPDATE WHERE.
      // This ensures that the database engine handles the concurrency check.
      const updateResult = await tx.update(players)
        .set({ balance: sql`${players.balance} - ${cost}` })
        .where(
          and(
            eq(players.id, playerId),
            gte(players.balance, cost) // Crucial check: only update if they have enough
          )
        )
        .returning({ updatedId: players.id });

      // If the array is empty, the WHERE clause failed (insufficient funds or player not found)
      if (updateResult.length === 0) {
        // Rollback transaction by returning false or throwing
        return false;
      }

      // 2. Insert the purchased item into the inventory
      await tx.insert(inventory).values({
        playerId,
        itemId,
      });

      return true;
    });

    if (!success) {
      return { success: false, message: "Insufficient balance or player not found." };
    }

    return { success: true, message: "Purchase successful." };
  } catch (error) {
    console.error("Database transaction failed:", error);
    return { success: false, message: "Transaction error." };
  }
}
