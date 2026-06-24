import { createAPIFileRoute } from "@tanstack/react-start/api";

// NOTE: In dev (Vite), this route is intercepted by server.ts before it reaches here.
// In production builds, createAPIFileRoute kicks in — both paths use the shared handler
// from webhook-handlers.server.ts which enforces mandatory signature verification.
import { handleLipilaWebhook } from "@/lib/api/webhook-handlers.server";

export const APIRoute = createAPIFileRoute("/api/lipila-webhook")({
  POST: async ({ request }) => handleLipilaWebhook(request),
  GET: async () =>
    new Response(JSON.stringify({ ok: true, service: "UStack Lipila webhook" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
});
