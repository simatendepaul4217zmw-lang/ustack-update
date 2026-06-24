import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createHmac, timingSafeEqual } from "node:crypto";
import { execute, queryOne } from "@/lib/db/index.server";
import { creditWallet } from "@/lib/api/wallet.functions";
import { getServerConfig } from "@/lib/config.server";

interface BlinkWebhookPayload {
  id?: string;
  type?: string;
  data?: {
    walletId?: string;
    paymentHash?: string;
    transaction?: {
      id?: string;
      status?: string;
      settlementAmount?: number;
      direction?: string;
    };
  };
}

function verifyBlinkSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(signatureHeader, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

// NOTE: In dev (Vite), this route is intercepted by server.ts before it reaches here.
// In production builds, createAPIFileRoute kicks in — both paths use the shared handler
// from webhook-handlers.server.ts which enforces mandatory signature verification.
import { handleBlinkWebhook } from "@/lib/api/webhook-handlers.server";

export const APIRoute = createAPIFileRoute("/api/blink-webhook")({
  POST: async ({ request }) => handleBlinkWebhook(request),
  GET: async () =>
    new Response(JSON.stringify({ ok: true, service: "UStack Blink webhook" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
});
