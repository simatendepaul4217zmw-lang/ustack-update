import { createHmac, timingSafeEqual } from "node:crypto";
import { execute, queryOne, withTransaction } from "../db/index.server";
import { creditWallet, creditVault } from "./wallet.functions";
import { getServerConfig } from "../config.server";
import { transferReserveToMain } from "./reserve.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ─── Blink webhook ────────────────────────────────────────────────────────────

interface BlinkWebhookPayload {
  data?: {
    paymentHash?: string;
    transaction?: { id?: string; status?: string; settlementAmount?: number; direction?: string };
  };
}

export async function handleBlinkWebhook(request: Request): Promise<Response> {
  const config = getServerConfig();
  const rawBody = await request.text();

  if (!config.blinkWebhookSecret) {
    console.error("[blink-webhook] BLINK_WEBHOOK_SECRET not set — rejecting all requests");
    return json({ error: "Webhook secret not configured on server" }, 500);
  }

  const sig =
    request.headers.get("x-blink-signature") ??
    request.headers.get("x-webhook-signature");

  if (!verifyHmac(rawBody, sig, config.blinkWebhookSecret)) {
    console.warn("[blink-webhook] Invalid signature — request rejected");
    return json({ error: "Invalid signature" }, 401);
  }

  let body: BlinkWebhookPayload;
  try {
    body = JSON.parse(rawBody) as BlinkWebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const paymentHash = body.data?.paymentHash ?? body.data?.transaction?.id;
  const status = (body.data?.transaction?.status ?? "").toUpperCase();
  const direction = (body.data?.transaction?.direction ?? "RECEIVE").toUpperCase();

  if (!paymentHash) return json({ ok: true, note: "no paymentHash" });
  if (direction !== "RECEIVE" || status !== "SUCCESS") {
    return json({ ok: true, note: "not a settled receive" });
  }

  // Idempotency: skip if already processed
  const alreadyDone = await queryOne<{ id: string }>(
    `SELECT id FROM transactions WHERE lightning_payment_hash=$1 AND status='confirmed' LIMIT 1`,
    [paymentHash]
  );
  if (alreadyDone) {
    console.log(`[blink-webhook] Duplicate webhook — already confirmed tx ${alreadyDone.id}`);
    return json({ ok: true, note: "already processed" });
  }

  const tx = await queryOne<{ id: string; user_id: string; amount_sats: string; vault_id: string | null }>(
    `SELECT id, user_id, amount_sats, vault_id FROM transactions
     WHERE lightning_payment_hash=$1 AND type='deposit' AND status='pending' LIMIT 1`,
    [paymentHash]
  );

  if (!tx) return json({ ok: true, note: "no pending tx found" });

  const amountSats = Number(tx.amount_sats);
  await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);

  if (tx.vault_id) {
    await creditVault(tx.user_id, tx.vault_id, amountSats);
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'vault_deposit',$2,$3)`,
      [tx.user_id, `Added ${amountSats.toLocaleString()} sats to vault`, "Lightning vault deposit confirmed"]
    );
    await execute(
      `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
      [tx.user_id, "Vault deposit confirmed",
       `Your deposit of ${amountSats.toLocaleString()} sats has been added to your vault.`]
    );
  } else {
    await creditWallet(tx.user_id, amountSats);
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
      [tx.user_id, `Added ${amountSats.toLocaleString()} sats`, "Lightning deposit confirmed"]
    );
    await execute(
      `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
      [tx.user_id, "Lightning deposit confirmed",
       `Your deposit of ${amountSats.toLocaleString()} sats has arrived.`]
    );
  }

  console.log(`[blink-webhook] Confirmed ${amountSats} sats for user ${tx.user_id}${tx.vault_id ? ` → vault ${tx.vault_id}` : ""}`);
  return json({ ok: true });
}

// ─── Lipila webhook ───────────────────────────────────────────────────────────

interface LipilaWebhookPayload {
  identifier?: string;      // new Lipila API field
  referenceId?: string;     // new Lipila API field
  transactionId?: string;   // legacy fallback
  externalId?: string;      // legacy fallback
  status?: string;
  transactionStatus?: string;
}

export async function handleLipilaWebhook(request: Request): Promise<Response> {
  const config = getServerConfig();

  if (!config.lipilaWebhookSecret) {
    console.error("[lipila-webhook] LIPILA_WEBHOOK_SECRET not set — rejecting all requests");
    return json({ error: "Webhook secret not configured on server" }, 500);
  }

  const sig =
    request.headers.get("x-lipila-signature") ??
    request.headers.get("x-webhook-secret");

  if (sig !== config.lipilaWebhookSecret) {
    console.warn("[lipila-webhook] Invalid signature — request rejected");
    return json({ error: "Invalid signature" }, 401);
  }

  let body: LipilaWebhookPayload;
  try {
    body = await request.json() as LipilaWebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const rawStatus = (body.transactionStatus ?? body.status ?? "").toUpperCase();
  const lipilaTransactionId = body.identifier ?? body.transactionId;
  const externalId = body.referenceId ?? body.externalId;

  if (!lipilaTransactionId && !externalId) {
    return json({ error: "Missing identifier/transactionId" }, 400);
  }

  // Idempotency: use canonical external_id column first, fall back to metadata fields
  const canonicalExternalId = externalId ?? lipilaTransactionId ?? "";
  const alreadyProcessed = await queryOne<{ id: string }>(
    `SELECT id FROM transactions
     WHERE (external_id=$1 OR metadata->>'lipilaTransactionId'=$2 OR metadata->>'externalId'=$1)
       AND status IN ('confirmed','failed') LIMIT 1`,
    [canonicalExternalId, lipilaTransactionId ?? ""]
  );
  if (alreadyProcessed) {
    console.log(`[lipila-webhook] Duplicate webhook — already processed tx ${alreadyProcessed.id}`);
    return json({ ok: true, note: "already processed" });
  }

  const tx = await queryOne<{ id: string; user_id: string; amount_sats: string; type: string; vault_id: string | null }>(
    `SELECT id, user_id, amount_sats, type, vault_id FROM transactions
     WHERE (external_id=$1 OR metadata->>'lipilaTransactionId'=$2 OR metadata->>'externalId'=$1)
       AND status='pending' LIMIT 1`,
    [canonicalExternalId, lipilaTransactionId ?? ""]
  );

  if (!tx) return json({ ok: true, note: "no pending tx found" });

  const amountSats = Number(tx.amount_sats);

  if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED") {

    if (tx.type === "deposit") {
      const priceRow = await queryOne<{ price_zmw: string; price_usd: string }>(
        `SELECT price_zmw, price_usd FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
      );
      const rateZmw = priceRow ? Number(priceRow.price_zmw) : null;
      const rateUsd = priceRow ? Number(priceRow.price_usd) : null;

      // Transfer sats Reserve→Main FIRST — if this fails, leave tx pending so Lipila retries
      try {
        await transferReserveToMain(
          amountSats,
          `MoMo deposit for user ${tx.user_id.slice(0, 8)}`,
          tx.id,
          rateZmw,
          rateUsd
        );
      } catch (err) {
        console.error("[lipila-webhook] Reserve→Main transfer failed — returning 500 for retry:", err);
        await execute(
          `INSERT INTO activity_logs(user_id, action, title, meta)
           VALUES($1,'reserve_transfer_failed','Reserve Transfer Failed',$2)`,
          [tx.user_id, JSON.stringify({ error: String(err), amount_sats: amountSats, tx_id: tx.id })]
        );
        // Return 500 so Lipila retries — tx stays pending
        return json({ error: "reserve transfer failed — will retry" }, 500);
      }

      // Reserve→Main succeeded — wrap confirm + ledger credit in one DB transaction
      await withTransaction(async (db) => {
        await db.execute(
          `UPDATE transactions SET status='confirmed', source_wallet='reserve', destination_wallet='main',
           external_id=$1, exchange_rate_zmw=$2, exchange_rate_usd=$3, updated_at=NOW() WHERE id=$4`,
          [canonicalExternalId, rateZmw, rateUsd, tx.id]
        );

        if (tx.vault_id) {
          await db.execute(
            `UPDATE wallets SET vault_sats=vault_sats+$1, updated_at=NOW() WHERE user_id=$2`,
            [amountSats, tx.user_id]
          );
          await db.execute(
            `UPDATE vaults SET current_sats=current_sats+$1, last_deposit_at=NOW(), updated_at=NOW()
             WHERE id=$2 AND user_id=$3 AND status='active'`,
            [amountSats, tx.vault_id, tx.user_id]
          );
          await db.execute(
            `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'vault_deposit',$2,$3)`,
            [tx.user_id, `Added ${amountSats.toLocaleString()} sats to vault`, "Mobile Money vault deposit confirmed"]
          );
          await db.execute(
            `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
            [tx.user_id, "Vault deposit confirmed",
             `Your MoMo deposit of ${amountSats.toLocaleString()} sats has been added to your vault.`]
          );
        } else {
          await db.execute(
            `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
            [amountSats, tx.user_id]
          );
          await db.execute(
            `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
            [tx.user_id, `Added ${amountSats.toLocaleString()} sats`, "Mobile Money deposit confirmed"]
          );
          await db.execute(
            `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
            [tx.user_id, "Deposit confirmed",
             `Your MoMo deposit of ${amountSats.toLocaleString()} sats has been confirmed.`]
          );
        }
      });
    } else if (tx.type === "send") {
      // MoMo withdrawal confirmed by Lipila — atomic confirm + activity log
      await withTransaction(async (db) => {
        await db.execute(
          `UPDATE transactions SET status='confirmed', external_id=$1, updated_at=NOW() WHERE id=$2`,
          [canonicalExternalId, tx.id]
        );
        await db.execute(
          `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw',$2,$3)`,
          [tx.user_id, `Sent ${amountSats.toLocaleString()} sats`, "Mobile Money withdrawal confirmed"]
        );
        await db.execute(
          `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'withdraw',$2,$3)`,
          [tx.user_id, "Withdrawal confirmed", `Your Mobile Money payout has been sent successfully.`]
        );
      });
    } else {
      await execute(
        `UPDATE transactions SET status='confirmed', external_id=$1, updated_at=NOW() WHERE id=$2`,
        [canonicalExternalId, tx.id]
      );
    }
  } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED") {
    if (tx.type === "send") {
      // Atomic: mark failed + refund sats
      await withTransaction(async (db) => {
        await db.execute(
          `UPDATE transactions SET status='failed', external_id=$1, updated_at=NOW() WHERE id=$2`,
          [canonicalExternalId, tx.id]
        );
        await db.execute(
          `UPDATE wallets SET available_sats=available_sats+$1, updated_at=NOW() WHERE user_id=$2`,
          [amountSats, tx.user_id]
        );
        await db.execute(
          `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'withdraw_failed',$2,$3)`,
          [tx.user_id, `Refunded ${amountSats.toLocaleString()} sats`, "Mobile Money withdrawal failed"]
        );
        await db.execute(
          `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'failed',$2,$3)`,
          [tx.user_id, "Withdrawal failed",
           "Your Mobile Money payout could not be completed. Your sats have been refunded."]
        );
      });
    } else {
      await withTransaction(async (db) => {
        await db.execute(
          `UPDATE transactions SET status='failed', external_id=$1, updated_at=NOW() WHERE id=$2`,
          [canonicalExternalId, tx.id]
        );
        await db.execute(
          `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'failed',$2,$3)`,
          [tx.user_id, "Deposit failed",
           "Your Mobile Money deposit could not be completed. Please try again."]
        );
      });
    }
  }

  console.log(`[lipila-webhook] Processed tx ${tx.id} (${tx.type}) → ${rawStatus}`);
  return json({ ok: true });
}
