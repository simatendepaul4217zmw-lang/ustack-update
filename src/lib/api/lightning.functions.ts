import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyToken } from "../auth.server";
import { createLightningInvoice, payLightningInvoice, confirmMockPayment } from "./blink.server";
import { execute, queryOne } from "../db/index.server";
import { creditWallet } from "./wallet.functions";

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

export const sendPayment = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    paymentRequest: z.string(),
    amountSats: z.number().int().positive(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    // Check available balance
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

    try {
      const result = await payLightningInvoice(payload.sub, data.paymentRequest, data.amountSats);
      return result;
    } catch (err) {
      // Refund on failure
      await execute(
        `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );
      throw err;
    }
  });

// DEV ONLY: simulate payment confirmation for mock invoices
export const confirmMockInvoice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ paymentHash: z.string() }))
  .handler(async ({ data }) => {
    await confirmMockPayment(data.paymentHash);
    return { ok: true };
  });

// Mobile money payout (send sats out via MoMo)
export const mobileMoneyPayout = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    phone: z.string(),
    amountSats: z.number().int().positive(),
    provider: z.enum(["airtel", "mtn", "zamtel"]),
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

    await execute(
      `UPDATE wallets SET available_sats=available_sats-$1, updated_at=NOW() WHERE user_id=$2`,
      [data.amountSats, payload.sub]
    );
    await execute(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata)
       VALUES($1,'send',$2,'confirmed','mobile_money',$3)`,
      [payload.sub, data.amountSats, JSON.stringify({ provider: data.provider, phone: data.phone })]
    );
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
      [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`,
       `Mobile Money · ${data.provider.toUpperCase()}`]
    );
    return { ok: true };
  });

// Mobile money deposit (stub — Airtel integration coming soon)
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

    // Stub: simulate instant confirmation for now
    await execute(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata)
       VALUES($1,'deposit',$2,'confirmed','mobile_money',$3)`,
      [payload.sub, data.amountSats, JSON.stringify({ provider: data.provider, phone: data.phone })]
    );
    await creditWallet(payload.sub, data.amountSats);
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
      [payload.sub, `Added ${data.amountSats.toLocaleString()} sats`,
       `Mobile Money · ${data.provider.toUpperCase()}`]
    );
    return { ok: true, amountSats: data.amountSats };
  });
