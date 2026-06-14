import { createHmac, timingSafeEqual } from "node:crypto";
import { execute, queryOne } from "../db/index.server";
import { creditWallet } from "./wallet.functions";
import { getServerConfig } from "../config.server";

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

  // Mandatory — reject if secret is not configured
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

  const tx = await queryOne<{ id: string; user_id: string; amount_sats: string }>(
    `SELECT id, user_id, amount_sats FROM transactions
     WHERE lightning_payment_hash=$1 AND type='deposit' AND status='pending' LIMIT 1`,
    [paymentHash]
  );

  if (!tx) return json({ ok: true, note: "no pending tx found" });

  const amountSats = Number(tx.amount_sats);
  await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);
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

  console.log(`[blink-webhook] Confirmed ${amountSats} sats for user ${tx.user_id}`);
  return json({ ok: true });
}

// ─── Lipila webhook ───────────────────────────────────────────────────────────

interface LipilaWebhookPayload {
  transactionId?: string;
  externalId?: string;
  status?: string;
  transactionStatus?: string;
}

export async function handleLipilaWebhook(request: Request): Promise<Response> {
  const config = getServerConfig();

  // Mandatory — reject if secret is not configured
  if (!config.lipilaWebhookSecret) {
    console.error("[lipila-webhook] LIPILA_WEBHOOK_SECRET not set — rejecting all requests");
    return json({ error: "Webhook secret not configured on server" }, 500);
  }

  const sig =
    request.headers.get("x-lipila-signature") ??
    request.headers.get("x-webhook-secret");

  // Lipila uses plain-string comparison (not HMAC), matching existing implementation
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
  const lipilaTransactionId = body.transactionId;
  const externalId = body.externalId;

  if (!lipilaTransactionId && !externalId) {
    return json({ error: "Missing transactionId" }, 400);
  }

  const tx = await queryOne<{ id: string; user_id: string; amount_sats: string; type: string }>(
    `SELECT id, user_id, amount_sats, type FROM transactions
     WHERE (metadata->>'lipilaTransactionId'=$1 OR metadata->>'externalId'=$2)
       AND status='pending' LIMIT 1`,
    [lipilaTransactionId ?? "", externalId ?? ""]
  );

  if (!tx) return json({ ok: true, note: "no pending tx found" });

  if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED") {
    await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);
    if (tx.type === "deposit") {
      await creditWallet(tx.user_id, Number(tx.amount_sats));
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
        [tx.user_id, `Added ${Number(tx.amount_sats).toLocaleString()} sats`, "Mobile Money deposit confirmed"]
      );
      await execute(
        `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'deposit',$2,$3)`,
        [tx.user_id, "Deposit confirmed",
         `Your MoMo deposit of ${Number(tx.amount_sats).toLocaleString()} sats has been confirmed.`]
      );
    }
  } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED") {
    await execute(`UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`, [tx.id]);
    await execute(
      `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,'failed',$2,$3)`,
      [tx.user_id, "Deposit failed",
       "Your Mobile Money deposit could not be completed. Please try again."]
    );
  }

  console.log(`[lipila-webhook] Processed tx ${tx.id} → ${rawStatus}`);
  return json({ ok: true });
}
