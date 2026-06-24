import { queryOne, execute } from "../db/index.server";
import { getTreasuryState, convertPartialUsdToBtc } from "./treasury.server";

const SLIPPAGE_BUFFER = 1.015; // 1.5% buffer to cover price movement

// ─── TreasuryConversionService ────────────────────────────────────────────────

export interface ConversionResult {
  usdCentsConverted: number;
  conversionRateUsd: number;
  blinkTxId: string;
}

async function getCurrentBtcPriceUsd(): Promise<number> {
  const row = await queryOne<{ price_usd: string }>(
    `SELECT price_usd FROM btc_prices ORDER BY fetched_at DESC LIMIT 1`
  );
  return row ? Number(row.price_usd) : 100_000;
}

export function satsToUsdCents(sats: number, btcPriceUsd: number): number {
  return Math.ceil((sats / 100_000_000) * btcPriceUsd * 100 * SLIPPAGE_BUFFER);
}

export async function convertUsdToBtcForWithdrawal(
  amountSats: number,
  userId: string
): Promise<ConversionResult> {
  const priceUsd = await getCurrentBtcPriceUsd();
  const usdCents = satsToUsdCents(amountSats, priceUsd);

  console.log(
    `[withdrawal] USD→BTC conversion: ${amountSats} sats = $${(usdCents / 100).toFixed(2)} ` +
    `(rate $${priceUsd.toFixed(2)}, incl. 1.5% buffer)`
  );

  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'treasury_usd_conversion',$2,$3)`,
    [
      userId,
      `Converting $${(usdCents / 100).toFixed(2)} USD → BTC for withdrawal`,
      JSON.stringify({ amount_sats: amountSats, usd_cents: usdCents, btc_price_usd: priceUsd }),
    ]
  );

  const blinkTxId = await convertPartialUsdToBtc(usdCents);

  return { usdCentsConverted: usdCents, conversionRateUsd: priceUsd, blinkTxId };
}

// ─── WithdrawalService ────────────────────────────────────────────────────────

export interface WithdrawalPrep {
  treasuryMode: "btc" | "usd";
  priceUsd: number;
  conversion: ConversionResult | null;
}

export async function prepareWithdrawal(
  userId: string,
  amountSats: number
): Promise<WithdrawalPrep> {
  const [state, priceUsd] = await Promise.all([
    getTreasuryState(),
    getCurrentBtcPriceUsd(),
  ]);

  const treasuryMode = (state?.current_mode ?? "btc") as "btc" | "usd";

  if (treasuryMode === "usd") {
    const conversion = await convertUsdToBtcForWithdrawal(amountSats, userId);
    return { treasuryMode, priceUsd, conversion };
  }

  return { treasuryMode, priceUsd, conversion: null };
}

export function buildWithdrawalMeta(
  extra: Record<string, unknown>,
  prep: WithdrawalPrep
): string {
  return JSON.stringify({
    ...extra,
    treasury_mode: prep.treasuryMode,
    conversion_rate: prep.priceUsd,
    usd_value: parseFloat(((prep.conversion?.usdCentsConverted ?? 0) / 100).toFixed(2)),
    ...(prep.conversion?.blinkTxId
      ? { conversion_tx_id: prep.conversion.blinkTxId }
      : {}),
  });
}
