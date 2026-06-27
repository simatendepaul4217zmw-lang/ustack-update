import { getServerConfig } from "../config.server";
import { queryOne, execute } from "../db/index.server";

let _btcWalletId: string | null = null;
let _usdWalletId: string | null = null;

async function fetchWallets(config: ReturnType<typeof getServerConfig>) {
  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.blinkApiKey! },
    body: JSON.stringify({ query: `query Me { me { defaultAccount { wallets { id walletCurrency balance } } } }` }),
  });
  const json = await res.json() as {
    data?: { me?: { defaultAccount?: { wallets?: { id: string; walletCurrency: string; balance: number }[] } } };
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data?.me?.defaultAccount?.wallets ?? [];
}

export async function getBtcWalletId(): Promise<string> {
  if (_btcWalletId) return _btcWalletId;
  const config = getServerConfig();
  if (config.mockBlink) return "mock-btc-wallet";
  const wallets = await fetchWallets(config);
  const w = wallets.find((w) => w.walletCurrency === "BTC");
  if (!w) throw new Error("No BTC wallet found in Blink account");
  _btcWalletId = w.id;
  return w.id;
}

export async function getUsdWalletId(): Promise<string> {
  if (_usdWalletId) return _usdWalletId;
  const config = getServerConfig();
  if (config.mockBlink) return "mock-usd-wallet";
  const wallets = await fetchWallets(config);
  const w = wallets.find((w) => w.walletCurrency === "USD");
  if (!w) throw new Error("No USD wallet found in Blink account. Enable stablesats on your Blink account.");
  _usdWalletId = w.id;
  return w.id;
}

export interface TreasuryBalances {
  btcSats: number;
  usdCents: number;
}

export async function getTreasuryBalances(): Promise<TreasuryBalances> {
  const config = getServerConfig();
  if (config.mockBlink) return { btcSats: 0, usdCents: 0 };

  const wallets = await fetchWallets(config);
  const btcWallet = wallets.find((w) => w.walletCurrency === "BTC");
  const usdWallet = wallets.find((w) => w.walletCurrency === "USD");
  return {
    btcSats: btcWallet?.balance ?? 0,
    usdCents: usdWallet?.balance ?? 0,
  };
}

// Sweep 100% of BTC wallet → USD wallet (intra-ledger)
export async function swapBtcToUsd(): Promise<string> {
  const config = getServerConfig();
  if (config.mockBlink) {
    console.log("[treasury] MOCK: swapBtcToUsd");
    return "mock-tx-btc-to-usd";
  }

  const [btcWalletId, usdWalletId, balances] = await Promise.all([
    getBtcWalletId(),
    getUsdWalletId(),
    getTreasuryBalances(),
  ]);

  // Blink stablesats rejects intra-ledger amounts below ~1 000 sats.
  // Return "noop-low-balance" so executeProtect can still advance state
  // to 'usd' mode and log the transition without crashing the loop.
  const MINIMUM_SWAP_SATS = 1_000;

  if (balances.btcSats <= 0) {
    console.log("[treasury] swapBtcToUsd: nothing to swap (btcSats=0)");
    return "noop";
  }

  if (balances.btcSats < MINIMUM_SWAP_SATS) {
    console.warn(`[treasury] swapBtcToUsd: BTC balance ${balances.btcSats} sats is below ${MINIMUM_SWAP_SATS}-sat minimum — skipping swap, advancing mode`);
    return "noop-low-balance";
  }

  console.log(`[treasury] swapBtcToUsd: swapping 100% of BTC balance — ${balances.btcSats} sats → USD stablesats`);

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.blinkApiKey! },
    body: JSON.stringify({
      query: `mutation IntraLedgerPaymentSend($input: IntraLedgerPaymentSendInput!) {
        intraLedgerPaymentSend(input: $input) {
          status
          errors { message }
          transaction { id }
        }
      }`,
      variables: {
        input: {
          walletId: btcWalletId,
          recipientWalletId: usdWalletId,
          amount: balances.btcSats,
          memo: "UStack price protection: BTC → USD",
        },
      },
    }),
  });

  const json = await res.json() as {
    data?: { intraLedgerPaymentSend?: { status: string; errors?: { message: string }[]; transaction?: { id: string } } };
    errors?: { message: string }[];
  };

  console.log("[treasury] swapBtcToUsd response:", JSON.stringify(json));

  const result = json.data?.intraLedgerPaymentSend;
  if (!result || result.status === "FAILURE") {
    const msg = result?.errors?.[0]?.message ?? json.errors?.[0]?.message ?? "BTC→USD swap failed";
    throw new Error(msg);
  }

  return result.transaction?.id ?? "unknown-tx";
}

// Sweep 100% of USD wallet → BTC wallet (intra-ledger)
export async function swapUsdToBtc(): Promise<string> {
  const config = getServerConfig();
  if (config.mockBlink) {
    console.log("[treasury] MOCK: swapUsdToBtc");
    return "mock-tx-usd-to-btc";
  }

  const [btcWalletId, usdWalletId, balances] = await Promise.all([
    getBtcWalletId(),
    getUsdWalletId(),
    getTreasuryBalances(),
  ]);

  if (balances.usdCents <= 0) {
    console.log("[treasury] swapUsdToBtc: nothing to swap (usdCents=0)");
    return "noop";
  }

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.blinkApiKey! },
    body: JSON.stringify({
      query: `mutation IntraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {
        intraLedgerUsdPaymentSend(input: $input) {
          status
          errors { message }
        }
      }`,
      variables: {
        input: {
          walletId: usdWalletId,
          recipientWalletId: btcWalletId,
          amount: balances.usdCents,
          memo: "UStack price recovery: USD → BTC",
        },
      },
    }),
  });

  const json = await res.json() as {
    data?: { intraLedgerUsdPaymentSend?: { status: string; errors?: { message: string }[] } };
    errors?: { message: string }[];
  };

  console.log("[treasury] swapUsdToBtc response:", JSON.stringify(json));

  const result = json.data?.intraLedgerUsdPaymentSend;
  if (!result || result.status === "FAILURE") {
    const msg = result?.errors?.[0]?.message ?? json.errors?.[0]?.message ?? "USD→BTC swap failed";
    throw new Error(msg);
  }

  return "recovered";
}

export interface TreasuryState {
  id: number;
  current_mode: "btc" | "usd";
  reference_price_usd: string;
  protection_price_usd: string;
  pending_action: "protect" | "recover" | null;
  pending_started_at: string | null;
  last_transition_at: string | null;
  last_transition_price: string | null;
  btc_wallet_id: string | null;
  usd_wallet_id: string | null;
}

export async function getTreasuryState(): Promise<TreasuryState | null> {
  return queryOne<TreasuryState>(`SELECT * FROM treasury_state ORDER BY id LIMIT 1`);
}

// Convert a specific USD cent amount from USD wallet → BTC wallet (partial swap for withdrawals)
export async function convertPartialUsdToBtc(usdCents: number): Promise<string> {
  const config = getServerConfig();

  if (config.mockBlink) {
    console.log(`[treasury] MOCK: convertPartialUsdToBtc ${usdCents} cents`);
    return "mock-partial-tx";
  }

  const [btcWalletId, usdWalletId] = await Promise.all([getBtcWalletId(), getUsdWalletId()]);

  const res = await fetch(config.blinkApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.blinkApiKey! },
    body: JSON.stringify({
      query: `mutation IntraLedgerUsdPaymentSend($input: IntraLedgerUsdPaymentSendInput!) {
        intraLedgerUsdPaymentSend(input: $input) {
          status
          errors { message }
        }
      }`,
      variables: {
        input: {
          walletId: usdWalletId,
          recipientWalletId: btcWalletId,
          amount: usdCents,
          memo: `UStack withdrawal conversion: $${(usdCents / 100).toFixed(2)} USD → BTC`,
        },
      },
    }),
  });

  const json = await res.json() as {
    data?: { intraLedgerUsdPaymentSend?: { status: string; errors?: { message: string }[] } };
    errors?: { message: string }[];
  };

  console.log("[treasury] convertPartialUsdToBtc response:", JSON.stringify(json));

  const result = json.data?.intraLedgerUsdPaymentSend;
  if (!result || result.status === "FAILURE") {
    const msg = result?.errors?.[0]?.message ?? json.errors?.[0]?.message ?? "USD→BTC partial conversion failed";
    throw new Error(msg);
  }

  return `usd-to-btc-${Date.now()}`;
}

export async function initTreasuryState(currentPriceUsd: number): Promise<TreasuryState> {
  const existing = await getTreasuryState();
  if (existing) return existing;

  const protectionPrice = currentPriceUsd * 0.98;
  await execute(
    `INSERT INTO treasury_state
       (current_mode, reference_price_usd, protection_price_usd)
     VALUES ('btc', $1, $2)`,
    [currentPriceUsd, protectionPrice]
  );

  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta)
     VALUES (NULL, 'treasury_init', 'Treasury Initialized',
       $1::jsonb)`,
    [JSON.stringify({ reference_price_usd: currentPriceUsd, protection_price_usd: protectionPrice })]
  );

  console.log(`[treasury] Initialized at $${currentPriceUsd.toFixed(2)}, protection at $${protectionPrice.toFixed(2)}`);
  return (await getTreasuryState())!;
}
