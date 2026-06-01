import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryOne, execute } from "../db/index.server";

const ZMW_PER_USD = 27.5; // fallback rate

export const getBtcPrice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ forceRefresh: z.boolean().optional() }))
  .handler(async ({ data }) => {
    // Return cached price if < 2 minutes old (unless forced)
    if (!data.forceRefresh) {
      const cached = await queryOne<{ price_zmw: string; price_usd: string; fetched_at: string }>(
        `SELECT price_zmw, price_usd, fetched_at FROM btc_prices
         WHERE fetched_at > NOW() - INTERVAL '2 minutes' ORDER BY fetched_at DESC LIMIT 1`
      );
      if (cached) {
        return {
          priceUsd: Number(cached.price_usd),
          priceZmw: Number(cached.price_zmw),
          change24h: null as number | null,
          cachedAt: cached.fetched_at,
          fresh: false,
        };
      }
    }

    // Fetch from CoinGecko
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,zmw&include_24hr_change=true"
      );
      if (!res.ok) throw new Error("CoinGecko unavailable");
      const json = await res.json() as { bitcoin?: { usd?: number; zmw?: number; usd_24h_change?: number } };
      const priceUsd = json.bitcoin?.usd ?? 0;
      const priceZmw = json.bitcoin?.zmw ?? priceUsd * ZMW_PER_USD;
      const change24h = json.bitcoin?.usd_24h_change ?? null;

      await execute(
        `INSERT INTO btc_prices(price_usd, price_zmw) VALUES($1,$2)`,
        [priceUsd, priceZmw]
      );

      return { priceUsd, priceZmw, change24h, cachedAt: new Date().toISOString(), fresh: true };
    } catch {
      // Fallback to last known price
      const last = await queryOne<{ price_zmw: string; price_usd: string; fetched_at: string }>(
        `SELECT price_zmw, price_usd, fetched_at FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
      );
      if (last) return { priceUsd: Number(last.price_usd), priceZmw: Number(last.price_zmw), change24h: null, cachedAt: last.fetched_at, fresh: false };
      return { priceUsd: 105_000, priceZmw: 105_000 * ZMW_PER_USD, change24h: null, cachedAt: new Date().toISOString(), fresh: false };
    }
  });
