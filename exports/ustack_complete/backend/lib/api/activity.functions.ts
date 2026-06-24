import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query, execute } from "../db/index.server";
import { verifyToken } from "../auth.server";

export const getActivity = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), limit: z.number().default(30) }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const rows = await query<{
      id: string; action: string; title: string; meta: string; created_at: string;
    }>(
      `SELECT id, action, title, meta, created_at FROM activity_logs
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [payload.sub, data.limit]
    );

    return rows.map((r) => ({
      id: r.id,
      kind: r.action as "deposit" | "milestone" | "streak" | "protection" | "withdraw" | "vault" | "vault_deposit" | "vault_withdraw" | "vault_created" | "login",
      title: r.title,
      meta: r.meta,
      when: timeAgo(new Date(r.created_at)),
    }));
  });

export const getNotifications = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const rows = await query<{
      id: string; kind: string; title: string; body: string; unread: boolean; created_at: string;
    }>(
      `SELECT id, kind, title, body, unread, created_at FROM notifications
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [payload.sub]
    );

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as "milestone" | "deposit" | "protection" | "summary" | "warning",
      title: r.title,
      body: r.body,
      when: timeAgo(new Date(r.created_at)),
      unread: r.unread,
    }));
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");
    await execute(`UPDATE notifications SET unread=false WHERE user_id=$1`, [payload.sub]);
    return { ok: true };
  });

export const getTransactions = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), limit: z.number().default(30) }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const rows = await query<{
      id: string; type: string; amount_sats: string; status: string;
      method: string | null; vault_id: string | null; created_at: string;
    }>(
      `SELECT t.id, t.type, t.amount_sats, t.status, t.method, t.vault_id, t.created_at,
              v.name as vault_name
       FROM transactions t LEFT JOIN vaults v ON t.vault_id=v.id
       WHERE t.user_id=$1 ORDER BY t.created_at DESC LIMIT $2`,
      [payload.sub, data.limit]
    );

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountSats: Number(r.amount_sats),
      status: r.status,
      method: r.method,
      vaultId: r.vault_id,
      when: timeAgo(new Date(r.created_at)),
    }));
  });

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${weeks}w ago`;
}
