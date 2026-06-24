import { query, queryOne } from "../db/index.server";
import { getTreasuryBalances } from "./treasury.server";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function handleStatus(): Promise<Response> {
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

  const dropPct =
    currentPrice && referencePrice
      ? Math.round(((currentPrice - referencePrice) / referencePrice) * 10000) / 100
      : null;

  let pendingSecondsRemaining: number | null = null;
  if (state?.pending_started_at) {
    const elapsed = Date.now() - new Date(state.pending_started_at).getTime();
    pendingSecondsRemaining = Math.max(0, Math.ceil((5 * 60 * 1000 - elapsed) / 1000));
  }

  return json({
    current_mode: state?.current_mode ?? "btc",
    reference_price_usd: referencePrice,
    protection_price_usd: protectionPrice,
    current_price_usd: currentPrice,
    drop_pct: dropPct,
    pending_action: state?.pending_action ?? null,
    pending_seconds_remaining: pendingSecondsRemaining,
    last_transition_at: state?.last_transition_at ?? null,
    last_transition_price: state?.last_transition_price
      ? Number(state.last_transition_price)
      : null,
    btc_sats: balances.btcSats,
    usd_cents: balances.usdCents,
    threshold_pct: 2,
  });
}

async function handleHistory(): Promise<Response> {
  const transitions = await query<{
    id: number;
    from_mode: string;
    to_mode: string;
    trigger_price: string;
    reference_price: string;
    blink_tx_id: string | null;
    created_at: string;
  }>(`SELECT * FROM treasury_transitions ORDER BY created_at DESC LIMIT 20`);

  return json({
    transitions: transitions.map((t) => ({
      id: t.id,
      from_mode: t.from_mode,
      to_mode: t.to_mode,
      trigger_price_usd: Number(t.trigger_price),
      reference_price_usd: Number(t.reference_price),
      blink_tx_id: t.blink_tx_id,
      created_at: t.created_at,
    })),
  });
}

export async function handleTreasuryApi(request: Request, pathname: string): Promise<Response> {
  try {
    if (pathname === "/api/treasury-status" && request.method === "GET") {
      return await handleStatus();
    }
    if (pathname === "/api/treasury-history" && request.method === "GET") {
      return await handleHistory();
    }
    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[treasury-api] error:", err);
    return json({ error: String(err) }, 500);
  }
}
