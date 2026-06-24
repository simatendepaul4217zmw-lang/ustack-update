import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleLipilaWebhook } from "@/lib/api/webhook-handlers.server";

export const APIRoute = createAPIFileRoute("/api/webhooks/lipila")({
  POST: async ({ request }) => handleLipilaWebhook(request),
  GET: async () =>
    new Response(JSON.stringify({ ok: true, service: "UStack Lipila webhook" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
});
