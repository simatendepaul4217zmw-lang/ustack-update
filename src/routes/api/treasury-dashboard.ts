import { createAPIFileRoute } from "@tanstack/react-start/api";
import { query, queryOne } from "@/lib/db/index.server";
import { getMainBalance, getReserveBalance } from "@/lib/api/reserve.server";
import { getServerConfig } from "@/lib/config.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const APIRoute = createAPIFileRoute("/api/treasury-dashboard")({
  GET: async ({ request }) => {
    const config = getServerConfig();

    // Simple token auth
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (!config.adminToken || token !== config.adminToken) {
      return json({ error: "Unauthorized" }, 401);
    }

    try {
      const [
        mainBalance,
        reserveBalance,
        liabilitiesRow,
        pendingDeposits,
        pendingWithdrawals,
        recentTransfers,
      ] = await Promise.all([
        getMainBalance().catch(() => null),
        getReserveBalance().catch(() => null),
        queryOne<{ total_sats: string }>(
          `SELECT COALESCE(SUM(available_sats + vault_sats), 0) AS total_sats FROM wallets`
        ),
        query<{
          id: string;
          user_id: string;
          amount_sats: string;
          metadata: string;
          created_at: string;
          external_id: string | null;
          exchange_rate_zmw: string | null;
        }>(
          `SELECT id, user_id, amount_sats, metadata, created_at, external_id, exchange_rate_zmw
           FROM transactions
           WHERE method='mobile_money' AND type='deposit' AND status='pending'
           ORDER BY created_at DESC LIMIT 50`
        ),
        query<{
          id: string;
          user_id: string;
          amount_sats: string;
          metadata: string;
          created_at: string;
          external_id: string | null;
          exchange_rate_zmw: string | null;
        }>(
          `SELECT id, user_id, amount_sats, metadata, created_at, external_id, exchange_rate_zmw
           FROM transactions
           WHERE method='mobile_money' AND type='send' AND status='pending'
           ORDER BY created_at DESC LIMIT 50`
        ),
        query<{
          id: string;
          from_wallet: string;
          to_wallet: string;
          amount_sats: string;
          reason: string | null;
          blink_tx_id: string | null;
          transaction_id: string | null;
          created_at: string;
        }>(
          `SELECT id, from_wallet, to_wallet, amount_sats, reason, blink_tx_id, transaction_id, created_at
           FROM wallet_transfers
           ORDER BY created_at DESC LIMIT 20`
        ),
      ]);

      const reserveMinimum = config.reserveMinimumBalance;
      const reserveSats = reserveBalance ?? 0;
      const utilizationPct = reserveMinimum > 0
        ? Math.round((reserveSats / reserveMinimum) * 100)
        : null;
      const isLowReserve = reserveSats < reserveMinimum;

      return json({
        main_balance_sats: mainBalance,
        reserve_balance_sats: reserveSats,
        reserve_minimum_sats: reserveMinimum,
        reserve_utilization_pct: utilizationPct,
        is_low_reserve: isLowReserve,
        total_user_liabilities_sats: liabilitiesRow
          ? Number(liabilitiesRow.total_sats)
          : 0,
        pending_deposits: pendingDeposits.map((t) => ({
          id: t.id,
          user_id: t.user_id,
          amount_sats: Number(t.amount_sats),
          external_id: t.external_id,
          exchange_rate_zmw: t.exchange_rate_zmw ? Number(t.exchange_rate_zmw) : null,
          metadata: (() => {
            try { return JSON.parse(t.metadata ?? "{}"); } catch { return {}; }
          })(),
          created_at: t.created_at,
        })),
        pending_withdrawals: pendingWithdrawals.map((t) => ({
          id: t.id,
          user_id: t.user_id,
          amount_sats: Number(t.amount_sats),
          external_id: t.external_id,
          exchange_rate_zmw: t.exchange_rate_zmw ? Number(t.exchange_rate_zmw) : null,
          metadata: (() => {
            try { return JSON.parse(t.metadata ?? "{}"); } catch { return {}; }
          })(),
          created_at: t.created_at,
        })),
        recent_transfers: recentTransfers.map((wt) => ({
          id: wt.id,
          from_wallet: wt.from_wallet,
          to_wallet: wt.to_wallet,
          amount_sats: Number(wt.amount_sats),
          reason: wt.reason,
          blink_tx_id: wt.blink_tx_id,
          transaction_id: wt.transaction_id,
          created_at: wt.created_at,
        })),
        fetched_at: new Date().toISOString(),
      });
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
});
