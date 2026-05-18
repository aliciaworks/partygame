import { drizzle } from "drizzle-orm/d1";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq, and, gte, sql } from "drizzle-orm";

// --- Schema Definitions ---

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  balance: integer("balance").notNull().default(0),
});

export const inventory = sqliteTable("inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  itemId: text("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  deletedAt: integer("deleted_at"), // Soft delete timestamp (UNIX epoch)
});

export const transactions = sqliteTable("transactions", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  playerId: text("player_id").notNull(),
  status: text("status").notNull(), // 'success', 'failed'
  createdAt: integer("created_at").notNull(),
});

// --- Game Database Logic ---

/**
 * Purchases an item for a player, deducting the cost from their balance
 * and adding the item to their inventory.
 * 
 * Includes Idempotency Check to prevent double charges on network retries.
 */
export async function purchaseItem(
  d1db: D1Database,
  playerId: string,
  itemId: string,
  cost: number,
  idempotencyKey: string
): Promise<{ success: boolean; message: string }> {
  const db = drizzle(d1db);

  try {
    const success = await db.transaction(async (tx) => {
      // 0. Idempotency Check
      const existingTx = await tx.select().from(transactions).where(eq(transactions.idempotencyKey, idempotencyKey)).get();
      if (existingTx) {
        // If the transaction already exists and was successful, return true without doing anything.
        if (existingTx.status === 'success') return true;
        tx.rollback();
        return false;
      }

      // 1. Atomic Balance Deduction
      const updateResult = await tx.update(users)
        .set({ balance: sql`${users.balance} - ${cost}` })
        .where(
          and(
            eq(users.id, playerId),
            gte(users.balance, cost) 
          )
        )
        .returning({ updatedId: users.id });

      if (updateResult.length === 0) {
        // Record failed transaction to prevent retries from doing anything else
        await tx.insert(transactions).values({ idempotencyKey, playerId, status: 'failed', createdAt: Date.now() });
        tx.rollback();
        return false;
      }

      // 2. Insert or update the purchased item in the inventory (ignoring soft-deleted items)
      const existingItem = await tx.select().from(inventory).where(
        and(
          eq(inventory.playerId, playerId),
          eq(inventory.itemId, itemId),
          sql`${inventory.deletedAt} IS NULL`
        )
      ).get();

      if (existingItem) {
        await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} + 1` })
          .where(eq(inventory.id, existingItem.id));
      } else {
        await tx.insert(inventory).values({
          playerId,
          itemId,
          quantity: 1,
        });
      }

      // 3. Record successful transaction
      await tx.insert(transactions).values({ idempotencyKey, playerId, status: 'success', createdAt: Date.now() });

      return true;
    });

    if (!success) {
      return { success: false, message: "Transaction failed: Insufficient balance or invalid state." };
    }

    return { success: true, message: "Purchase successful." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Rollback")) {
      return { success: false, message: "Transaction failed." };
    }
    console.error("Database transaction failed:", error);
    return { success: false, message: "Transaction error." };
  }
}


