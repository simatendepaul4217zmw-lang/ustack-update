import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyToken } from "../auth.server";
import { createLightningInvoice, payLightningInvoice, payLightningAddress, payOnChain, getOnChainFee, confirmMockPayment, getLightningInvoiceStatus } from "./blink.server";
import { execute, queryOne, withTransaction } from "../db/index.server";
import { creditWallet, creditVault } from "./wallet.functions";
import { requestPayment, disburseFunds, getLipilaStatus } from "./lipila.server";
import { getServerConfig } from "../config.server";
import { prepareWithdrawal, buildWithdrawalMeta } from "./withdrawal.service";

async function satsToZmw(amountSats: number): Promise<number> {
  const row = await queryOne<{ price_zmw: string }>(
    `SELECT price_zmw FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
  );
  const priceZmw = row ? Number(row.price_zmw) : 105_000 * 27.5;
  return (amountSats / 100_000_000) * priceZmw;
}

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
    vaultId: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    return createLightningInvoice(payload.sub, data.amountSats, data.memo, data.vaultId);
  });

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

    const destination = data.paymentRequest.trim();
    const isLnAddress = isLightningAddress(destination);
    const isInvoice = destination.toLowerCase().startsWith("lnbc") ||
                      destination.toLowerCase().startsWith("lntb") ||
                      destination.toLowerCase().startsWith("lnurl");

    if (!isLnAddress && !isInvoice) {
      throw new Error("Invalid Lightning invoice or address");
    }

    const sentinelId = await withTransaction(async (db) => {
      const row = await db.queryOne<{ available_sats: string }>(
        `SELECT available_sats FROM wallets WHERE user_id=$1 FOR UPDATE`,
        [payload.sub]
      );
      if (!row || Number(row.available_sats) < data.amountSats) {
        throw new Error("Insufficient balance");
      }

      const sentinel = await db.queryOne<{ id: string }>(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method)
         VALUES($1,'withdraw',$2,'initiated','lightning') RETURNING id`,
        [payload.sub, data.amountSats]
      );

      await db.execute(
        `UPDATE wallets SET available_sats=available_sats-$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );

      return sentinel!.id;
    });

    try {
      const prep = await prepareWithdrawal(payload.sub, data.amountSats);

      let result: { success: boolean; status: "SUCCESS" | "PENDING" };
      if (isLnAddress) {
        result = await payLightningAddress(payload.sub, destination, data.amountSats);
      } else {
        result = await payLightningInvoice(payload.sub, destination, data.amountSats);
      }

      await execute(
        `UPDATE transactions SET status='reconciled', updated_at=NOW() WHERE id=$1`,
        [sentinelId]
      );

      const statusLabel = result.status === "PENDING" ? "Lightning · pending confirmation" : "Lightning · confirmed";
      const meta = buildWithdrawalMeta({ channel: "lightning", destination }, prep);

      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`, statusLabel]
      );
      await execute(
        `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, "Lightning payment sent",
         `${data.amountSats.toLocaleString()} sats sent${result.status === "PENDING" ? " (confirming…)" : ""}`]
      );
      await execute(
        `UPDATE transactions SET meta=COALESCE(meta,'{}')::jsonb || $1::jsonb
         WHERE user_id=$2 AND type='withdraw' AND status IN ('pending','confirmed')
         ORDER BY created_at DESC LIMIT 1`,
        [meta, payload.sub]
      );

      return { ...result, treasuryMode: prep.treasuryMode };
    } catch (err) {
      await execute(
        `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );
      await execute(
        `UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`,
        [sentinelId]
      );
      throw err;
    }
  });

export const estimateOnChainFee = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    address: z.string(),
    amountSats: z.number().int().positive(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    const fee = await getOnChainFee(data.address, data.amountSats);
    return { feeSats: fee };
  });

export const sendOnChainPayment = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    address: z.string(),
    amountSats: z.number().int().positive(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const sentinelId = await withTransaction(async (db) => {
      const row = await db.queryOne<{ available_sats: string }>(
        `SELECT available_sats FROM wallets WHERE user_id=$1 FOR UPDATE`,
        [payload.sub]
      );
      if (!row || Number(row.available_sats) < data.amountSats) {
        throw new Error("Insufficient balance");
      }

      const sentinel = await db.queryOne<{ id: string }>(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method)
         VALUES($1,'withdraw',$2,'initiated','onchain') RETURNING id`,
        [payload.sub, data.amountSats]
      );

      await db.execute(
        `UPDATE wallets SET available_sats=available_sats-$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );

      return sentinel!.id;
    });

    try {
      const prep = await prepareWithdrawal(payload.sub, data.amountSats);
      const result = await payOnChain(payload.sub, data.address, data.amountSats);

      await execute(
        `UPDATE transactions SET status='reconciled', updated_at=NOW() WHERE id=$1`,
        [sentinelId]
      );

      const statusLabel = result.status === "PENDING" ? "On-chain · confirming (~10 min)" : "On-chain · confirmed";
      const meta = buildWithdrawalMeta({ channel: "onchain", address: data.address }, prep);

      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`, statusLabel]
      );
      await execute(
        `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, "On-chain payment sent",
         `${data.amountSats.toLocaleString()} sats sent to ${data.address.slice(0, 12)}…`]
      );
      await execute(
        `UPDATE transactions SET meta=COALESCE(meta,'{}')::jsonb || $1::jsonb
         WHERE user_id=$2 AND type='withdraw' AND meta->>'channel'='onchain'
         ORDER BY created_at DESC LIMIT 1`,
        [meta, payload.sub]
      );

      return { ...result, treasuryMode: prep.treasuryMode };
    } catch (err) {
      await execute(
        `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );
      await execute(
        `UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`,
        [sentinelId]
      );
      throw err;
    }
  });

export const checkInvoiceStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    paymentHash: z.string(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const tx = await queryOne<{ id: string; status: string; amount_sats: string; lightning_invoice: string; vault_id: string | null }>(
      `SELECT id, status, amount_sats, lightning_invoice, vault_id FROM transactions
       WHERE lightning_payment_hash=$1 AND user_id=$2 LIMIT 1`,
      [data.paymentHash, payload.sub]
    );

    if (!tx) return { status: "pending" as const, amountSats: 0 };

    if (tx.status !== "pending") {
      return {
        status: tx.status as "confirmed" | "failed",
        amountSats: Number(tx.amount_sats),
      };
    }

    const blinkStatus = await getLightningInvoiceStatus(tx.lightning_invoice);

    if (blinkStatus === "PAID") {
      const amountSats = Number(tx.amount_sats);
      await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);

      if (tx.vault_id) {
        await creditVault(payload.sub, tx.vault_id, amountSats);
        await execute(
          `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'vault_deposit',$2,$3)`,
          [payload.sub, `Added ${amountSats.toLocaleString()} sats to vault`, "Lightning vault deposit confirmed"]
        );
      } else {
        await creditWallet(payload.sub, amountSats);
        await execute(
          `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
          [payload.sub, `Added ${amountSats.toLocaleString()} sats`, "Lightning deposit confirmed"]
        );
      }
      await execute(
        `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
        [payload.sub, "Lightning deposit confirmed",
         `Your deposit of ${Number(tx.amount_sats).toLocaleString()} sats has arrived.`]
      );
      return { status: "confirmed" as const, amountSats };
    }

    if (blinkStatus === "EXPIRED") {
      await execute(`UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`, [tx.id]);
      return { status: "failed" as const, amountSats: Number(tx.amount_sats) };
    }

    return { status: "pending" as const, amountSats: Number(tx.amount_sats) };
  });

export const confirmMockInvoice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), paymentHash: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const config = getServerConfig();
    if (!config.mockBlink) throw new Error("Mock payments are not available in production.");

    await confirmMockPayment(data.paymentHash);
    return { ok: true };
  });

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

    const priceZmwRow = await queryOne<{ price_zmw: string; price_usd: string }>(
      `SELECT price_zmw, price_usd FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
    );
    const priceZmw = priceZmwRow ? Number(priceZmwRow.price_zmw) : 105_000 * 27.5;
    const priceUsd = priceZmwRow ? Number(priceZmwRow.price_usd) : 105_000;

    const sentinelId = await withTransaction(async (db) => {
      const row = await db.queryOne<{ available_sats: string }>(
        `SELECT available_sats FROM wallets WHERE user_id=$1 FOR UPDATE`,
        [payload.sub]
      );
      if (!row || Number(row.available_sats) < data.amountSats) {
        throw new Error("Insufficient balance");
      }

      const sentinel = await db.queryOne<{ id: string }>(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method, source_wallet, destination_wallet, exchange_rate_zmw, exchange_rate_usd)
         VALUES($1,'send',$2,'initiated','mobile_money','main','reserve',$3,$4) RETURNING id`,
        [payload.sub, data.amountSats, priceZmw, priceUsd]
      );

      await db.execute(
        `UPDATE wallets SET available_sats=available_sats-$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );

      return sentinel!.id;
    });

    const config = getServerConfig();
    const { getTreasuryState } = await import("./treasury.server");
    const { transferMainToReserve } = await import("./reserve.server");
    const treasuryState = await getTreasuryState().catch(() => null);
    const treasuryMode = treasuryState?.current_mode ?? "btc";

    try {
      if (config.mockLipila) {
        await execute(
          `UPDATE transactions SET status='confirmed', metadata=$1, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify({ provider: data.provider, phone: data.phone, mock: true, treasury_mode: treasuryMode }), sentinelId]
        );
        await execute(
          `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
          [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`,
           `Mobile Money · ${data.provider.toUpperCase()}`]
        );
        return { ok: true, mock: true };
      }

      const amountZmw = (data.amountSats / 100_000_000) * priceZmw;
      const externalId = `ustack-payout-${Date.now()}-${payload.sub.slice(0, 8)}`;

      // Step 1: Move sats from Main wallet → Reserve wallet
      await transferMainToReserve(
        data.amountSats,
        `MoMo withdrawal for user ${payload.sub.slice(0, 8)}`,
        sentinelId
      );

      // Step 2: Disburse ZMW to user via Lipila
      const result = await disburseFunds({
        phone: data.phone,
        amountZmw,
        externalId,
        narration: `UStack payout · ${data.provider.toUpperCase()}`,
        fullName: data.fullName,
      });

      await execute(
        `UPDATE transactions SET status='confirmed',
         metadata=$1, updated_at=NOW() WHERE id=$2`,
        [JSON.stringify({
          provider: data.provider, phone: data.phone, amountZmw,
          lipilaTransactionId: result.transactionId, externalId, treasury_mode: treasuryMode,
        }), sentinelId]
      );
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
        [payload.sub, `Sent ${data.amountSats.toLocaleString()} sats`,
         `Mobile Money · ${data.provider.toUpperCase()} · K${amountZmw.toFixed(2)}`]
      );
      return { ok: true, transactionId: result.transactionId, amountZmw };
    } catch (err) {
      await execute(
        `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
        [data.amountSats, payload.sub]
      );
      await execute(
        `UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`,
        [sentinelId]
      );
      throw err;
    }
  });

export const mobileMoneySend = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    phone: z.string(),
    amountSats: z.number().int().positive(),
    provider: z.enum(["airtel", "mtn", "zamtel"]),
    vaultId: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const config = getServerConfig();

    if (config.mockLipila) {
      await execute(
        `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata, vault_id)
         VALUES($1,'deposit',$2,'confirmed','mobile_money',$3,$4)`,
        [payload.sub, data.amountSats,
         JSON.stringify({ provider: data.provider, phone: data.phone, mock: true }),
         data.vaultId ?? null]
      );
      if (data.vaultId) {
        await creditVault(payload.sub, data.vaultId, data.amountSats);
      } else {
        await creditWallet(payload.sub, data.amountSats);
      }
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,$2,$3,$4)`,
        [payload.sub,
         data.vaultId ? "vault_deposit" : "deposit",
         `Added ${data.amountSats.toLocaleString()} sats`,
         `Mobile Money · ${data.provider.toUpperCase()}`]
      );
      return { ok: true, mock: true, amountSats: data.amountSats, pending: false };
    }

    const priceRow = await queryOne<{ price_zmw: string; price_usd: string }>(
      `SELECT price_zmw, price_usd FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
    );
    const priceZmw = priceRow ? Number(priceRow.price_zmw) : 105_000 * 27.5;
    const priceUsd = priceRow ? Number(priceRow.price_usd) : 105_000;
    const amountZmw = (data.amountSats / 100_000_000) * priceZmw;
    const externalId = `ustack-deposit-${Date.now()}-${payload.sub.slice(0, 8)}`;

    const txRow = await queryOne<{ id: string }>(
      `INSERT INTO transactions(user_id, type, amount_sats, status, method, metadata, vault_id, source_wallet, destination_wallet, exchange_rate_zmw, exchange_rate_usd)
       VALUES($1,'deposit',$2,'pending','mobile_money',$3,$4,'reserve','main',$5,$6) RETURNING id`,
      [payload.sub, data.amountSats,
       JSON.stringify({ provider: data.provider, phone: data.phone, amountZmw, externalId }),
       data.vaultId ?? null, priceZmw, priceUsd]
    );

    const result = await requestPayment({
      phone: data.phone,
      amountZmw,
      externalId,
      narration: `UStack BTC savings deposit · K${amountZmw.toFixed(2)}`,
    });

    await execute(
      `UPDATE transactions SET metadata=metadata || $1::jsonb WHERE id=$2`,
      [JSON.stringify({ lipilaTransactionId: result.transactionId }), txRow?.id]
    );

    return {
      ok: true, mock: false, pending: true,
      amountSats: data.amountSats, amountZmw,
      transactionId: result.transactionId,
      message: result.message,
    };
  });

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

    if (status.status === "SUCCESS") {
      const tx = await queryOne<{ id: string; user_id: string; amount_sats: string; status: string; vault_id: string | null }>(
        `SELECT id, user_id, amount_sats, status, vault_id FROM transactions
         WHERE metadata->>'lipilaTransactionId'=$1 AND user_id=$2`,
        [data.lipilaTransactionId, payload.sub]
      );
      if (tx && tx.status === "pending") {
        const amountSats = Number(tx.amount_sats);
        await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);
        if (tx.vault_id) {
          await creditVault(tx.user_id, tx.vault_id, amountSats);
          await execute(
            `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'vault_deposit',$2,$3)`,
            [tx.user_id, `Added ${amountSats.toLocaleString()} sats to vault`, "Mobile Money vault deposit confirmed"]
          );
        } else {
          await creditWallet(tx.user_id, amountSats);
          await execute(
            `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
            [tx.user_id, `Added ${amountSats.toLocaleString()} sats`, "Mobile Money deposit confirmed"]
          );
        }
      }
    }

    return { status: status.status };
  });
