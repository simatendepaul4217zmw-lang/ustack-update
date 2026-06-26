import process from "node:process";

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET,
    // Blink — Main wallet (customer funds, Lightning/on-chain withdrawals)
    blinkApiKey: process.env.MAIN_BLINK_API_KEY || process.env.BLINK_API_KEY,
    blinkApiUrl: "https://api.blink.sv/graphql",
    blinkWalletId: process.env.MAIN_BLINK_WALLET_ID || process.env.BLINK_WALLET_ID,
    blinkWebhookSecret: process.env.BLINK_WEBHOOK_SECRET,
    mockBlink: !process.env.MAIN_BLINK_API_KEY && !process.env.BLINK_API_KEY,
    // Blink — Reserve wallet (MoMo liquidity)
    reserveBlinkApiKey: process.env.RESERVE_BLINK_API_KEY,
    reserveBlinkWalletId: process.env.RESERVE_BLINK_WALLET_ID,
    reserveMinimumBalance: Number(process.env.RESERVE_MINIMUM_BALANCE ?? "1000000"),
    mockReserveBlink: !process.env.RESERVE_BLINK_API_KEY,
    // Lipila (Mobile Money)
    lipilaApiKey: process.env.LIPILA_API_KEY,
    lipilaBaseUrl: process.env.LIPILA_BASE_URL || "https://blz.lipila.io",
    mockLipila: !process.env.LIPILA_API_KEY,
    lipilaWebhookSecret: process.env.LIPILA_WEBHOOK_SECRET,
    // CoinGecko
    coingeckoUrl: "https://api.coingecko.com/api/v3",
  };
}
