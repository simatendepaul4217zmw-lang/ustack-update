import { createAPIFileRoute } from "@tanstack/react-start/api";
import { query } from "@/lib/db/index.server";

export const APIRoute = createAPIFileRoute("/api/treasury-history")({
  GET: async () => {
    try {
      const transitions = await query<{
        id: number;
        from_mode: string;
        to_mode: string;
        trigger_price: string;
        reference_price: string;
        blink_tx_id: string | null;
        created_at: string;
      }>(`SELECT * FROM treasury_transitions ORDER BY created_at DESC LIMIT 20`);

      return new Response(
        JSON.stringify({
          transitions: transitions.map((t) => ({
            id: t.id,
            from_mode: t.from_mode,
            to_mode: t.to_mode,
            trigger_price_usd: Number(t.trigger_price),
            reference_price_usd: Number(t.reference_price),
            blink_tx_id: t.blink_tx_id,
            created_at: t.created_at,
          })),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
