import type { Hono } from "hono";
import type { ModuleManifest, WorkerModule } from "../loader";
import { isFeatureEnabled } from "../../platform-state";
import iap from "in-app-purchase";

export const economyManifest: ModuleManifest = {
  id: "economy",
  name: "Game Economy & IAP",
  description: "Manage universal player balances and verify In-App Purchases.",
  icon: "ti-coins",
};

export const economyModule: WorkerModule = {
  manifest: economyManifest,
  init(app: Hono<any>) {
    app.get("/economy/balance", async (c) => {
      // Gate check
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "economy" as any);
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const playerId = c.req.query("playerId");
      if (!playerId) return c.json({ error: "Missing playerId" }, 400);

      // Query D1 for balances
      const { results } = await c.env.DB.prepare(
        "SELECT currency_id as currencyId, amount FROM player_balances WHERE player_id = ?"
      )
        .bind(playerId)
        .all();

      const balances: Record<string, number> = {};
      for (const row of results || []) {
        balances[row.currencyId as string] = row.amount as number;
      }

      return c.json({ balances });
    });

    app.post("/economy/iap/verify", async (c) => {
      // Gate check
      const enabled = await isFeatureEnabled(c.env.PLATFORM_BUCKET, "economy" as any);
      if (!enabled) return c.json({ error: "FEATURE_DISABLED" }, 403);

      const body = await c.req.json().catch(() => ({}));
      const { playerId, receipt, platform } = body;
      // platform should be 'apple', 'google', 'amazon', 'windows'

      if (!playerId || !receipt || !platform) {
        return c.json({ error: "Missing playerId, receipt, or platform" }, 400);
      }

      try {
        // Setup IAP
        iap.config({
          applePassword: (c.env as any).APPLE_IAP_PASSWORD || "",
          googleServiceAccount: {
            clientEmail: (c.env as any).GOOGLE_IAP_CLIENT_EMAIL || "",
            privateKey: (c.env as any).GOOGLE_IAP_PRIVATE_KEY || "",
          },
        });

        await iap.setup();

        const validatedData = (await iap.validate(
          platform === "apple" ? iap.APPLE : iap.GOOGLE,
          receipt
        )) as any;

        if (!iap.isValidated(validatedData)) {
          return c.json({ error: "INVALID_RECEIPT" }, 400);
        }

        const purchaseDataList = iap.getPurchaseData(validatedData);
        if (!purchaseDataList || purchaseDataList.length === 0) {
          return c.json({ error: "NO_PURCHASE_DATA" }, 400);
        }

        const purchases = [];

        for (const purchase of purchaseDataList) {
          const transactionId = purchase.transactionId;
          const productId = purchase.productId;

          // Check if already processed
          const existing = await c.env.DB.prepare(
            "SELECT transaction_id FROM iap_receipts WHERE transaction_id = ?"
          )
            .bind(transactionId)
            .first();

          if (existing) {
            purchases.push({ transactionId, status: "ALREADY_PROCESSED" });
            continue;
          }

          // Record receipt
          await c.env.DB.prepare(
            "INSERT INTO iap_receipts (transaction_id, player_id, platform, raw_receipt, status) VALUES (?, ?, ?, ?, ?)"
          )
            .bind(transactionId, playerId, platform, JSON.stringify(purchase), "valid")
            .run();

          // We map productId to currency and amount here, but for now we just return success
          // A real implementation would lookup productId from PlatformState products table.
          purchases.push({ transactionId, productId, status: "SUCCESS" });
        }

        return c.json({ purchases });
      } catch (err: any) {
        return c.json({ error: "VALIDATION_ERROR", details: err.message }, 500);
      }
    });

    // Add endpoint for the developer to securely grant currencies from the server-side
    app.post("/economy/grant", async (c) => {
      // Must be authenticated via Admin API (not implemented here, but assume it's protected by other middleware)
      const body = await c.req.json().catch(() => ({}));
      const { playerId, currencyId, amount } = body;

      if (!playerId || !currencyId || typeof amount !== "number") {
        return c.json({ error: "Missing required fields" }, 400);
      }

      await c.env.DB.prepare(`
        INSERT INTO player_balances (player_id, currency_id, amount)
        VALUES (?, ?, ?)
        ON CONFLICT (player_id, currency_id) DO UPDATE SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP
      `).bind(playerId, currencyId, amount, amount).run();

      return c.json({ success: true, playerId, currencyId, granted: amount });
    });
  },
};
