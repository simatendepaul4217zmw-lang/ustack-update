import { query, execute } from "../db/index.server";

let ran = false;

export async function recoverStuckWithdrawals(): Promise<void> {
  if (ran) return;
  ran = true;

  try {
    const stuck = await query<{ id: string; user_id: string; amount_sats: string }>(
      `SELECT id, user_id, amount_sats FROM transactions
       WHERE status = 'initiated' AND created_at < NOW() - INTERVAL '5 minutes'`
    );

    if (stuck.length === 0) {
      console.log("[recovery] No stuck withdrawals found");
      return;
    }

    console.warn(`[recovery] Found ${stuck.length} stuck withdrawal(s) — refunding`);

    for (const tx of stuck) {
      const amountSats = Number(tx.amount_sats);
      await execute(
        `UPDATE wallets SET available_sats = available_sats + $1, updated_at = NOW()
         WHERE user_id = $2`,
        [amountSats, tx.user_id]
      );
      await execute(
        `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [tx.id]
      );
      await execute(
        `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'refund',$2,$3)`,
        [
          tx.user_id,
          `Refunded ${amountSats.toLocaleString()} sats`,
          JSON.stringify({ reason: "withdrawal_recovery", original_tx_id: tx.id }),
        ]
      );
      console.log(`[recovery] Refunded ${amountSats} sats → user ${tx.user_id} (tx ${tx.id})`);
    }
  } catch (err) {
    console.error("[recovery] recoverStuckWithdrawals failed:", err);
  }
}
