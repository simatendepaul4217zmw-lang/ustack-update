import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createHmac, timingSafeEqual } from "node:crypto";
import { execute, queryOne } from "@/lib/db/index.server";
import { creditWallet } from "@/lib/api/wallet.functions";
import { getServerConfig } from "@/lib/config.server";

interface BlinkWebhookPayload {
  id?: string;
  type?: string;
  data?: {
    walletId?: string;
    paymentHash?: string;
    transaction?: {
      id?: string;
      status?: string;
      settlementAmount?: number;
      direction?: string;
    };
  };
}

function verifyBlinkSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(signatureHeader, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export const APIRoute = createAPIFileRoute("/api/blink-webhook")({
  POST: async ({ request }) => {
    const config = getServerConfig();
    const rawBody = await request.text();

    // Verify signature when secret is configured
    if (config.blinkWebhookSecret) {
      const sig =
        request.headers.get("x-blink-signature") ??
        request.headers.get("x-webhook-signature");
      if (!verifyBlinkSignature(rawBody, sig, config.blinkWebhookSecret)) {
        console.warn("[blink-webhook] invalid signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
        });
      }
    }

    let body: BlinkWebhookPayload;
    try {
      body = JSON.parse(rawBody) as BlinkWebhookPayload;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
      });
    }

    const paymentHash =
      body.data?.paymentHash ??
      body.data?.transaction?.id;

    const status =
      (body.data?.transaction?.status ?? "").toUpperCase();

    const direction =
      (body.data?.transaction?.direction ?? "RECEIVE").toUpperCase();

    if (!paymentHash) {
      return new Response(JSON.stringify({ ok: true, note: "no paymentHash" }), {
        status: 200,
      });
    }

    // Only process incoming (RECEIVE) settled payments
    if (direction !== "RECEIVE" || status !== "SUCCESS") {
      return new Response(JSON.stringify({ ok: true, note: "not a settled receive" }), {
        status: 200,
      });
    }

    // Find a matching pending deposit transaction
    const tx = await queryOne<{
      id: string;
      user_id: string;
      amount_sats: string;
      status: string;
    }>(
      `SELECT id, user_id, amount_sats, status
       FROM transactions
       WHERE lightning_payment_hash = $1
         AND type = 'deposit'
         AND status = 'pending'
       LIMIT 1`,
      [paymentHash]
    );

    if (!tx) {
      return new Response(
        JSON.stringify({ ok: true, note: "no pending tx found" }),
        { status: 200 }
      );
    }

    const amountSats = Number(tx.amount_sats);

    await execute(
      `UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`,
      [tx.id]
    );
    await creditWallet(tx.user_id, amountSats);
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta)
       VALUES($1, 'deposit', $2, $3)`,
      [
        tx.user_id,
        `Added ${amountSats.toLocaleString()} sats`,
        "Lightning deposit confirmed",
      ]
    );
    await execute(
      `INSERT INTO notifications(user_id, kind, title, body)
       VALUES($1, 'deposit', $2, $3)`,
      [
        tx.user_id,
        "Lightning deposit confirmed",
        `Your deposit of ${amountSats.toLocaleString()} sats has arrived.`,
      ]
    );

    console.log(
      `[blink-webhook] confirmed deposit ${amountSats} sats for user ${tx.user_id}`
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },

  GET: async () =>
    new Response(JSON.stringify({ ok: true, service: "UStack Blink webhook" }), {
      status: 200,
    }),
});
