import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { startPriceLoop } from "./lib/api/price-loop.server";
import { handleTreasuryApi } from "./lib/api/treasury-api.server";
import { handleBlinkWebhook, handleLipilaWebhook } from "./lib/api/webhook-handlers.server";
import { recoverStuckWithdrawals } from "./lib/api/recovery.server";

// Start the price watch + treasury protection loop on server boot
startPriceLoop();

// Refund any withdrawals that were mid-flight when the server last crashed
recoverStuckWithdrawals();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Handle treasury API routes directly (createAPIFileRoute doesn't work in Vite dev mode)
      if (url.pathname.startsWith("/api/treasury-")) {
        return await handleTreasuryApi(request, url.pathname);
      }

      // Handle webhook routes directly with mandatory signature verification
      if (url.pathname === "/api/blink-webhook") {
        if (request.method === "GET") {
          return new Response(JSON.stringify({ ok: true, service: "UStack Blink webhook" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
        return await handleBlinkWebhook(request);
      }

      if (url.pathname === "/api/lipila-webhook") {
        if (request.method === "GET") {
          return new Response(JSON.stringify({ ok: true, service: "UStack Lipila webhook" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
        return await handleLipilaWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
