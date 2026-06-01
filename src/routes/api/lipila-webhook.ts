import { createAPIFileRoute } from "@tanstack/react-start/api";
import { execute, queryOne } from "@/lib/db/index.server";
import { creditWallet } from "@/lib/api/wallet.functions";
import { getServerConfig } from "@/lib/config.server";

interface LipilaWebhookPayload {
  transactionId?: string;
  externalId?: string;
  status?: string;
  transactionStatus?: string;
  amount?: number;
  currency?: string;
  phoneNumber?: string;
  accountNumber?: string;
}

export const APIRoute = createAPIFileRoute("/api/lipila-webhook")({
  POST: async ({ request }) => {
    try {
      const config = getServerConfig();

      // Optional webhook signature verification
      if (config.lipilaWebhookSecret) {
        const sig = request.headers.get("x-lipila-signature") ?? request.headers.get("x-webhook-secret");
        if (sig !== config.lipilaWebhookSecret) {
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
        }
      }

      const body = await request.json() as LipilaWebhookPayload;
      const rawStatus = (body.transactionStatus ?? body.status ?? "").toUpperCase();
      const lipilaTransactionId = body.transactionId;
      const externalId = body.externalId;

      if (!lipilaTransactionId && !externalId) {
        return new Response(JSON.stringify({ error: "Missing transactionId" }), { status: 400 });
      }

      // Find the matching pending transaction by Lipila transaction ID or externalId
      const tx = await queryOne<{ id: string; user_id: string; amount_sats: string; type: string; status: string }>(
        `SELECT id, user_id, amount_sats, type, status FROM transactions
         WHERE (metadata->>'lipilaTransactionId'=$1 OR metadata->>'externalId'=$2)
           AND status='pending'
         LIMIT 1`,
        [lipilaTransactionId ?? "", externalId ?? ""]
      );

      if (!tx) {
        // No pending tx found — either already processed or unknown
        return new Response(JSON.stringify({ ok: true, note: "no pending tx found" }), { status: 200 });
      }

      if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED") {
        // Confirm deposit and credit wallet
        await execute(`UPDATE transactions SET status='confirmed', updated_at=NOW() WHERE id=$1`, [tx.id]);

        if (tx.type === "deposit") {
          await creditWallet(tx.user_id, Number(tx.amount_sats));
          await execute(
            `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'deposit',$2,$3)`,
            [tx.user_id, `Added ${Number(tx.amount_sats).toLocaleString()} sats`, "Mobile Money deposit confirmed"]
          );
          await execute(
            `INSERT INTO notifications(user_id, type, title, body) VALUES($1,'deposit',$2,$3)`,
            [tx.user_id, "Deposit confirmed", `Your MoMo deposit of ${Number(tx.amount_sats).toLocaleString()} sats has been confirmed.`]
          );
        }
      } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED") {
        await execute(`UPDATE transactions SET status='failed', updated_at=NOW() WHERE id=$1`, [tx.id]);
        await execute(
          `INSERT INTO notifications(user_id, type, title, body) VALUES($1,'failed',$2,$3)`,
          [tx.user_id, "Deposit failed", "Your Mobile Money deposit could not be completed. Please try again."]
        );
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      console.error("[lipila-webhook] error:", err);
      return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
    }
  },

  // Lipila may send a GET ping to verify the endpoint
  GET: async () => {
    return new Response(JSON.stringify({ ok: true, service: "UStack Lipila webhook" }), { status: 200 });
  },
});
