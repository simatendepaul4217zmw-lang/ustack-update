import { createAPIFileRoute } from "@tanstack/react-start/api";
import { queryOne } from "@/lib/db/index.server";
import { getTreasuryBalances } from "@/lib/api/treasury.server";

export const APIRoute = createAPIFileRoute("/api/treasury-status")({
  GET: async () => {
    try {
      const [state, price] = await Promise.all([
        queryOne<{
          current_mode: string;
          reference_price_usd: string;
          protection_price_usd: string;
          pending_action: string | null;
          pending_started_at: string | null;
          last_transition_at: string | null;
          last_transition_price: string | null;
        }>(`SELECT * FROM treasury_state ORDER BY id LIMIT 1`),
        queryOne<{ price_usd: string }>(
          `SELECT price_usd FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
        ),
      ]);

      const balances = await getTreasuryBalances().catch(() => ({ btcSats: 0, usdCents: 0 }));
      const currentPrice = price ? Number(price.price_usd) : null;
      const referencePrice = state ? Number(state.reference_price_usd) : null;
      const protectionPrice = state ? Number(state.protection_price_usd) : null;

      const dropPct = currentPrice && referencePrice
        ? ((currentPrice - referencePrice) / referencePrice) * 100
        : null;

      let pendingSecondsRemaining: number | null = null;
      if (state?.pending_started_at) {
        const elapsed = Date.now() - new Date(state.pending_started_at).getTime();
        const remaining = 5 * 60 * 1000 - elapsed;
        pendingSecondsRemaining = Math.max(0, Math.ceil(remaining / 1000));
      }

      return new Response(
        JSON.stringify({
          current_mode: state?.current_mode ?? "btc",
          reference_price_usd: referencePrice,
          protection_price_usd: protectionPrice,
          current_price_usd: currentPrice,
          drop_pct: dropPct !== null ? Math.round(dropPct * 100) / 100 : null,
          pending_action: state?.pending_action ?? null,
          pending_seconds_remaining: pendingSecondsRemaining,
          last_transition_at: state?.last_transition_at ?? null,
          last_transition_price: state?.last_transition_price
            ? Number(state.last_transition_price)
            : null,
          btc_sats: balances.btcSats,
          usd_cents: balances.usdCents,
          threshold_pct: 2,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
