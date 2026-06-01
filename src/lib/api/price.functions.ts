import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryOne, execute } from "../db/index.server";

const ZMW_PER_USD = 27.5; // fallback rate

async function get30mChange(currentUsd: number): Promise<number | null> {
  const row = await queryOne<{ price_usd: string }>(
    `SELECT price_usd FROM btc_prices
     WHERE fetched_at <= NOW() - INTERVAL '28 minutes'
     ORDER BY fetched_at DESC LIMIT 1`
  );
  if (!row) return null;
  const prev = Number(row.price_usd);
  if (!prev) return null;
  return ((currentUsd - prev) / prev) * 100;
}

export const getBtcPrice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ forceRefresh: z.boolean().optional() }))
  .handler(async ({ data }) => {
    if (!data.forceRefresh) {
      const cached = await queryOne<{ price_zmw: string; price_usd: string; fetched_at: string }>(
        `SELECT price_zmw, price_usd, fetched_at FROM btc_prices
         WHERE fetched_at > NOW() - INTERVAL '2 minutes' ORDER BY fetched_at DESC LIMIT 1`
      );
      if (cached) {
        const change30m = await get30mChange(Number(cached.price_usd));
        return {
          priceUsd: Number(cached.price_usd),
          priceZmw: Number(cached.price_zmw),
          change30m,
          cachedAt: cached.fetched_at,
          fresh: false,
        };
      }
    }

    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,zmw"
      );
      if (!res.ok) throw new Error("CoinGecko unavailable");
      const json = await res.json() as { bitcoin?: { usd?: number; zmw?: number } };
      const priceUsd = json.bitcoin?.usd ?? 0;
      const priceZmw = json.bitcoin?.zmw ?? priceUsd * ZMW_PER_USD;

      await execute(
        `INSERT INTO btc_prices(price_usd, price_zmw) VALUES($1,$2)`,
        [priceUsd, priceZmw]
      );

      const change30m = await get30mChange(priceUsd);
      return { priceUsd, priceZmw, change30m, cachedAt: new Date().toISOString(), fresh: true };
    } catch {
      const last = await queryOne<{ price_zmw: string; price_usd: string; fetched_at: string }>(
        `SELECT price_zmw, price_usd, fetched_at FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
      );
      if (last) {
        const change30m = await get30mChange(Number(last.price_usd));
        return { priceUsd: Number(last.price_usd), priceZmw: Number(last.price_zmw), change30m, cachedAt: last.fetched_at, fresh: false };
      }
      return { priceUsd: 105_000, priceZmw: 105_000 * ZMW_PER_USD, change30m: null, cachedAt: new Date().toISOString(), fresh: false };
    }
  });
