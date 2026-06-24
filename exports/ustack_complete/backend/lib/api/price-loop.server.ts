import { queryOne, execute } from "../db/index.server";
import { evaluateProtection } from "./protection.service";

let started = false;

const ZMW_PER_USD = 27.5;

async function fetchAndStoreBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,zmw"
    );
    if (!res.ok) throw new Error("CoinGecko unavailable");
    const json = await res.json() as { bitcoin?: { usd?: number; zmw?: number } };
    const priceUsd = json.bitcoin?.usd ?? 0;
    const priceZmw = json.bitcoin?.zmw ?? priceUsd * ZMW_PER_USD;
    if (priceUsd > 0) {
      await execute(
        `INSERT INTO btc_prices(price_usd, price_zmw) VALUES($1,$2)`,
        [priceUsd, priceZmw]
      );
    }
    return priceUsd;
  } catch {
    const last = await queryOne<{ price_usd: string }>(
      `SELECT price_usd FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
    );
    return last ? Number(last.price_usd) : 0;
  }
}

async function tick() {
  const priceUsd = await fetchAndStoreBtcPrice();
  if (priceUsd > 0) {
    await evaluateProtection(priceUsd);
  }
}

export function startPriceLoop() {
  if (started) return;
  started = true;
  console.log("[price-loop] Starting — fetching BTC price every 60s");
  tick().catch(console.error);
  setInterval(() => tick().catch(console.error), 60_000);
}
