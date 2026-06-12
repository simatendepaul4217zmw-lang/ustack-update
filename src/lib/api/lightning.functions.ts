import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyToken } from "../auth.server";
import { createLightningInvoice, payLightningInvoice, payLightningAddress, confirmMockPayment, getLightningInvoiceStatus } from "./blink.server";
import { execute, queryOne } from "../db/index.server";
import { creditWallet } from "./wallet.functions";
import { requestPayment, disburseFunds, getLipilaStatus } from "./lipila.server";
import { getServerConfig } from "../config.server";

// Helper: convert sats to ZMW using latest stored price
async function satsToZmw(amountSats: number): Promise<number> {
  const row = await queryOne<{ price_zmw: string }>(
    `SELECT price_zmw FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
  );
  const priceZmw = row ? Number(row.price_zmw) : 105_000 * 27.5;
  return (amountSats / 100_000_000) * priceZmw;
}

// Helper: convert ZMW to sats
async function zmwToSats(amountZmw: number): Promise<number> {
  const row = await queryOne<{ price_zmw: string }>(
    `SELECT price_zmw FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
  );
  const priceZmw = row ? Number(row.price_zmw) : 105_000 * 27.5;
  return Math.floor((amountZmw / priceZmw) * 100_000_000);
}

export const createInvoice = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    amountSats: z.number().int().positive(),
    memo: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    return createLightningInvoice(payload.sub, data.amountSats, data.memo);
  });

// Detects if a string is a Lightning Address (user@domain.com)
function isLightningAddress(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

export const sendPayment = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    paymentRequest: z.string(),
    amountSats: z.number().int().positive(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const wallet = await queryOne<{ available_sats: string }>(
      `SELECT available_sats FROM wallets WHERE user_id=$1`, [payload.sub]
    );
    if (!wallet || Number(wallet.available_sats) < data.amountSats) {
      throw new Error("Insufficient balance");
    }

    const destination = data.paymentRequest.trim();
    const isLnAddress = isLightningAddress(destination);
    const isInvoice = destination.toLowerCase().startsWith("lnbc") ||
                      destination.toLowerCase().startsWith("lntb") ||
                      destination.toLowerCase().startsWith("lnurl");

    if (!isLnAddress && !isInvoice) {
      throw new Error("Invalid Lightning invoice or address");
    }

    // Deduct balance optimistically
    await execute(
      `UPDATE wallets SET available_sats=available_sats-$1, updated_at=NOW() WHERE user_id=$2`,
      [data.amountSats, payload.sub]
    );

    try {
      let result: { success: boolean; status: "SUCCESS" | "PENDING" };

      if (isLnAddress) {
        result = await payLightningAddress(payload.sub, destination, data.amountSats);
      } else {
        result = await payLightningInvoice(payload.sub, destination, data.amountSats);
      }

      // Record activity log
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
        [
          payload.sub,
          `Sent ${data.amountSats.toLocaleString()} sats`,
          result.status === "PENDING" ? "Lightning · pending confirmation" : "Lightning · confirmed",
        ]
      );

      // Record notification
      await execute(
        `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'withdraw',$2,$3)`,
        [
          payload.sub,
          "Lightning payment sent",
          `${data.amountSats.toLocaleString()} sats sent${result.status === "PENDING" ? " (confirming…)" : ""}`,
        ]
      );

      return result;
    } catch (err) {
      // Refund balance on failure
      await execute(
        `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );
      throw err;
    }
  });

// Poll whether a Lightning invoice has been paid.
// Checks DB first; if still pending, queries Blink directly and auto-confirms.
export const checkInvoiceStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    paymentHash: z.string(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const tx = await queryOne<{ id: string; status: string; amount_sats: string; lightning_invoice: string }>(
      `SELECT id, status, amount_sats, lightning_invoice FROM transactions
       WHERE lightning_payment_hash=$1 AND user_id=$2 LIMIT 1`,
      [data.paymentHash, payload.sub]
    );

    if (!tx) return { status: "pending" as const, amountSats: 0 };

    // Already confirmed or failed — return immediately
    if (tx.status !== "pending") {
      return {
        status: tx.status as "confirmed" | "failed",
        amountSats: Number(tx.amount_sats),
      };
    }

    // Still pending — ask Blink directly
    const blinkStatus = await getLightningInvoiceStatus(tx.lightning_invoice);

    if (blinkStatus === "PAID") {
      await execute(
        `UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`,
        [tx.id]
      );
      await creditWallet(payload.sub, Number(tx.amount_sats));
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
        [payload.sub, `Added ${Number(tx.amount_sats).toLocaleString()} sats`, "Lightning deposit confirmed"]
      );
      await execute(
        `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
        [payload.sub, "Lightning deposit confirmed",
         `Your deposit of ${Number(tx.amount_sats).toLocaleString()} sats has arrived.`]
      );
      return { status: "confirmed" as const, amountSats: Number(tx.amount_sats) };
    }

    if (blinkStatus === "EXPIRED") {
      await execute(
        `UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`,
        [tx.id]
      );
      return { status: "failed" as const, amountSats: Number(tx.amount_sats) };
    }

    return { status: "pending" as const, amountSats: Number(tx.amount_sats) };
  });

// DEV ONLY: simulate payment confirmation for mock invoices
export const confirmMockInvoice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ paymentHash: z.string() }))
  .handler(async ({ data }) => {
    await confirmMockPayment(data.paymentHash);
    return { ok: true };
  });

// Mobile money payout — send sats out converted to ZMW via Lipila
export const mobileMoneyPayout = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    phone: z.string(),
    amountSats: z.number().int().positive(),
    provider: z.enum(["airtel", "mtn", "zamtel"]),
    fullName: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const wallet = await queryOne<{ available_sats: string }>(
      `SELECT available_sats FROM wallets WHERE user_id=$1`, [payload.sub]
    );
    if (!wallet || Number(wallet.available_sats) < data.amountSats) {
      throw new Error("Insufficient balance");
    }

    // Deduct balance first
    await execute(
      `UPDATE wallets SET available_sats=available_sats-$1, updated_at=NOW() WHERE user_id=$2`,
      [data.amountSats, payload.sub]
    );

    const config = getServerConfig();

    if (config.mockLipila) {
      // Mock: instant confirmation
      await execute(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata)
         VALUES($1,'send',$2,'confirmed','mobile_money',$3)`,
        [payload.sub, data.amountSats, JSON.stringify({ provider: data.provider, phone: data.phone, mock: true })]
      );
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`,
         `Mobile Money · ${data.provider.toUpperCase()}`]
      );
      return { ok: true, mock: true };
    }

    // Convert sats → ZMW
    const amountZmw = await satsToZmw(data.amountSats);

    // Generate a unique external ID for tracking
    const externalId = `ustack-payout-${Date.now()}-${payload.sub.slice(0, 8)}`;

    try {
      const result = await disburseFunds({
        phone: data.phone,
        amountZmw,
        externalId,
        narration: `UStack payout · ${data.provider.toUpperCase()}`,
        fullName: data.fullName,
      });

      await execute(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata)
         VALUES($1,'send',$2,'confirmed','mobile_money',$3)`,
        [payload.sub, data.amountSats, JSON.stringify({
          provider: data.provider,
          phone: data.phone,
          amountZmw,
          lipilaTransactionId: result.transactionId,
          externalId,
        })]
      );
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`,
         `Mobile Money · ${data.provider.toUpperCase()} · K${amountZmw.toFixed(2)}`]
      );
      return { ok: true, transactionId: result.transactionId, amountZmw };
    } catch (err) {
      // Refund on failure
      await execute(
        `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );
      throw err;
    }
  });

// Mobile money deposit — request ZMW payment from user via Lipila
export const mobileMoneySend = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    phone: z.string(),
    amountSats: z.number().int().positive(),
    provider: z.enum(["airtel", "mtn", "zamtel"]),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const config = getServerConfig();

    if (config.mockLipila) {
      // Mock: instant deposit
      await execute(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata)
         VALUES($1,'deposit',$2,'confirmed','mobile_money',$3)`,
        [payload.sub, data.amountSats, JSON.stringify({ provider: data.provider, phone: data.phone, mock: true })]
      );
      await creditWallet(payload.sub, data.amountSats);
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
        [payload.sub, `Added ${data.amountSats.toLocaleString()} sats`,
         `Mobile Money · ${data.provider.toUpperCase()}`]
      );
      return { ok: true, mock: true, amountSats: data.amountSats, pending: false };
    }

    // Convert sats → ZMW for the payment request
    const amountZmw = await satsToZmw(data.amountSats);
    const externalId = `ustack-deposit-${Date.now()}-${payload.sub.slice(0, 8)}`;

    // Insert a PENDING transaction — webhook will confirm it
    const txRow = await queryOne<{ id: string }>(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata)
       VALUES($1,'deposit',$2,'pending','mobile_money',$3) RETURNING id`,
      [payload.sub, data.amountSats, JSON.stringify({
        provider: data.provider,
        phone: data.phone,
        amountZmw,
        externalId,
      })]
    );

    const result = await requestPayment({
      phone: data.phone,
      amountZmw,
      externalId,
      narration: `UStack BTC savings deposit · K${amountZmw.toFixed(2)}`,
    });

    // Store Lipila transaction ID back into the transaction row
    await execute(
      `UPDATE transactions SET metadata=metadata || $1::jsonb WHERE id=$2`,
      [JSON.stringify({ lipilaTransactionId: result.transactionId }), txRow?.id]
    );

    return {
      ok: true,
      mock: false,
      pending: true,
      amountSats: data.amountSats,
      amountZmw,
      transactionId: result.transactionId,
      message: result.message,
    };
  });

// Poll transaction status (for pending MoMo deposits)
export const checkMomoStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    lipilaTransactionId: z.string(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const config = getServerConfig();
    if (config.mockLipila) return { status: "SUCCESS" as const };

    const status = await getLipilaStatus(data.lipilaTransactionId);

    // If confirmed via polling, credit wallet and mark transaction confirmed
    if (status.status === "SUCCESS") {
      const tx = await queryOne<{ id: string; user_id: string; amount_sats: string; status: string }>(
        `SELECT id, user_id, amount_sats, status FROM transactions
         WHERE metadata->>'lipilaTransactionId'=$1 AND user_id=$2`,
        [data.lipilaTransactionId, payload.sub]
      );
      if (tx && tx.status === "pending") {
        await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);
        await creditWallet(tx.user_id, Number(tx.amount_sats));
        await execute(
          `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
          [tx.user_id, `Added ${Number(tx.amount_sats).toLocaleString()} sats`, `Mobile Money deposit confirmed`]
        );
      }
    }

    return { status: status.status };
  });
