import process from "node:process";

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET,
    // Blink (Lightning)
    blinkApiKey: process.env.BLINK_API_KEY,
    blinkApiUrl: "https://api.blink.sv/graphql",
    blinkWalletId: process.env.BLINK_WALLET_ID,
    mockBlink: !process.env.BLINK_API_KEY,
    // Lipila (Mobile Money)
    lipilaApiKey: process.env.LIPILA_API_KEY,
    lipilaBaseUrl: process.env.LIPILA_BASE_URL || "https://blaze.lipila.dev",
    mockLipila: !process.env.LIPILA_API_KEY,
    lipilaWebhookSecret: process.env.LIPILA_WEBHOOK_SECRET,
    // CoinGecko
    coingeckoUrl: "https://api.coingecko.com/api/v3",
  };
}
