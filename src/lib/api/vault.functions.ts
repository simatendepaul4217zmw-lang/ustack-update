import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query, queryOne, execute } from "../db/index.server";
import { verifyToken } from "../auth.server";
import { lockIntoVault, unlockFromVault } from "./wallet.functions";

export interface Vault {
  id: string;
  user_id: string;
  name: string;
  vault_type: "stack" | "hodl";
  emoji: string;
  accent: "btc" | "purple" | "teal" | "blue" | "rose" | "gold";
  goal_sats: number;
  current_sats: number;
  goal_fiat: number;
  currency: string;
  locked_until: string | null;
  withdrawal_penalty_pct: number;
  status: string;
  streak_days: number;
  last_deposit_at: string | null;
  created_at: string;
}

export const getVaults = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const vaults = await query<Vault>(
      `SELECT * FROM vaults WHERE user_id=$1 AND status='active' ORDER BY created_at DESC`,
      [payload.sub]
    );
    return vaults.map(normalizeVault);
  });

export const getVault = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), vaultId: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const vault = await queryOne<Vault>(
      `SELECT * FROM vaults WHERE id=$1 AND user_id=$2`,
      [data.vaultId, payload.sub]
    );
    if (!vault) throw new Error("Vault not found");
    return normalizeVault(vault);
  });

export const createVault = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    name: z.string().min(1).max(50),
    vaultType: z.enum(["stack", "hodl"]),
    emoji: z.string().default("💰"),
    accent: z.enum(["btc", "purple", "teal", "blue", "rose", "gold"]).default("btc"),
    goalSats: z.number().int().positive(),
    goalFiat: z.number().optional(),
    currency: z.string().default("ZMW"),
    lockMonths: z.number().int().min(0).default(0),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const lockedUntil = data.lockMonths > 0
      ? new Date(Date.now() + data.lockMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const penalty = data.vaultType === "hodl" ? 10 : 0;

    const vault = await queryOne<Vault>(
      `INSERT INTO vaults(user_id, name, vault_type, emoji, accent, goal_sats, goal_fiat, currency, locked_until, withdrawal_penalty_pct)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [payload.sub, data.name, data.vaultType, data.emoji, data.accent, data.goalSats,
       data.goalFiat ?? null, data.currency, lockedUntil, penalty]
    );

    await logActivity(payload.sub, "vault_created", `Created "${data.name}" vault`,
      `${data.vaultType === "hodl" ? "Hodl" : "Stack"} Vault`);

    return normalizeVault(vault!);
  });

export const depositToVault = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    vaultId: z.string(),
    amountSats: z.number().int().positive(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const vault = await queryOne<Vault>(
      `SELECT * FROM vaults WHERE id=$1 AND user_id=$2 AND status='active'`,
      [data.vaultId, payload.sub]
    );
    if (!vault) throw new Error("Vault not found");

    // Move sats from available → vault balance
    await lockIntoVault(payload.sub, data.amountSats);

    // Update vault
    const now = new Date().toISOString();
    await execute(
      `UPDATE vaults SET current_sats=current_sats+$1, last_deposit_at=NOW(),
       streak_days=CASE WHEN last_deposit_at > NOW()-INTERVAL '48 hours' THEN streak_days+1 ELSE 1 END,
       updated_at=NOW() WHERE id=$2`,
      [data.amountSats, data.vaultId]
    );

    // Log transaction
    await execute(
      `INSERT INTO transactions(user_id, vault_id, type, amount_sats, status, method)
       VALUES($1,$2,'vault_deposit',$3,'confirmed','internal')`,
      [payload.sub, data.vaultId, data.amountSats]
    );

    await logActivity(payload.sub, "vault_deposit",
      `Added ${data.amountSats.toLocaleString()} sats to ${vault.name}`,
      `${vault.name} · Internal`);

    // Check milestones
    const updated = await queryOne<Vault>(`SELECT * FROM vaults WHERE id=$1`, [data.vaultId]);
    const pct = (Number(updated!.current_sats) / Number(updated!.goal_sats)) * 100;
    for (const milestone of [25, 50, 75, 100]) {
      const prev = ((Number(vault.current_sats)) / Number(vault.goal_sats)) * 100;
      if (prev < milestone && pct >= milestone) {
        await insertNotification(payload.sub, "milestone",
          `${vault.name} hit ${milestone}%!`,
          `You've saved ${milestone}% of your goal. Keep going!`);
        await logActivity(payload.sub, "milestone",
          `${vault.name} reached ${milestone}%`, "Milestone unlocked");
      }
    }

    return { ok: true, newBalance: Number(updated!.current_sats) };
  });

export const withdrawFromVault = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    vaultId: z.string(),
    amountSats: z.number().int().positive(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const vault = await queryOne<Vault>(
      `SELECT * FROM vaults WHERE id=$1 AND user_id=$2 AND status='active'`,
      [data.vaultId, payload.sub]
    );
    if (!vault) throw new Error("Vault not found");
    if (Number(vault.current_sats) < data.amountSats) throw new Error("Insufficient vault balance");

    // Hodl vaults are completely blocked while time-locked
    if (vault.vault_type === "hodl") {
      const isTimeLocked = vault.locked_until && new Date(vault.locked_until) > new Date();
      if (isTimeLocked) throw new Error("Hodl vault is time-locked. Withdrawal is not permitted until the lock expires.");
    }

    // Stack vaults: apply penalty if below goal
    let penalty = 0;
    if (vault.vault_type === "stack") {
      const satsPct = Number(vault.current_sats) / Number(vault.goal_sats);
      if (satsPct < 1 && vault.withdrawal_penalty_pct > 0) {
        penalty = Math.floor(data.amountSats * vault.withdrawal_penalty_pct / 100);
      }
    }
    const net = data.amountSats - penalty;

    await execute(
      `UPDATE vaults SET current_sats=current_sats-$1, updated_at=NOW() WHERE id=$2`,
      [data.amountSats, data.vaultId]
    );

    await unlockFromVault(payload.sub, net);

    await execute(
      `INSERT INTO transactions(user_id, vault_id, type, amount_sats, status, method, metadata)
       VALUES($1,$2,'vault_withdraw',$3,'confirmed','internal',$4)`,
      [payload.sub, data.vaultId, data.amountSats, JSON.stringify({ penalty, net })]
    );

    await logActivity(payload.sub, "vault_withdraw",
      `Withdrew ${net.toLocaleString()} sats from ${vault.name}`,
      penalty > 0 ? `${vault.withdrawal_penalty_pct}% early penalty applied` : vault.name);

    return { ok: true, net, penalty };
  });

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeVault(v: Vault) {
  const nowMs = Date.now();
  const lockedUntilMs = v.locked_until ? new Date(v.locked_until).getTime() : 0;
  const createdAtMs = v.created_at ? new Date(v.created_at).getTime() : nowMs;

  const daysRemaining = lockedUntilMs > nowMs
    ? Math.ceil((lockedUntilMs - nowMs) / (1000 * 60 * 60 * 24))
    : 0;

  // Time-based progress for hodl vaults: 0→1 over the full lock duration
  const lockDurationMs = lockedUntilMs > 0 ? lockedUntilMs - createdAtMs : 0;
  const lockElapsedMs = Math.max(0, nowMs - createdAtMs);
  const lockProgressPct = lockDurationMs > 0
    ? Math.min(lockElapsedMs / lockDurationMs, 1)
    : 0;

  // Days since vault was created (useful for stack vaults)
  const daysSinceCreated = Math.floor((nowMs - createdAtMs) / (1000 * 60 * 60 * 24));

  return {
    id: v.id,
    name: v.name,
    type: v.vault_type as "stack" | "hodl",
    emoji: v.emoji,
    accent: v.accent as "btc" | "purple" | "teal" | "blue" | "rose" | "gold",
    goalSats: Number(v.goal_sats),
    currentSats: Number(v.current_sats),
    goalFiat: Number(v.goal_fiat ?? 0),
    currency: v.currency,
    daysRemaining,
    daysSinceCreated,
    streakDays: Number(v.streak_days),
    lockProgressPct,
    locked: !!v.locked_until && new Date(v.locked_until) > new Date(),
    lockedUntil: v.locked_until,
    penaltyPct: v.withdrawal_penalty_pct,
    status: v.status,
    createdAt: v.created_at,
  };
}

async function logActivity(userId: string, action: string, title: string, meta: string) {
  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,$2,$3,$4)`,
    [userId, action, title, meta]
  );
}

async function insertNotification(userId: string, kind: string, title: string, body: string) {
  await execute(
    `INSERT INTO notifications(user_id, kind, title, body) VALUES($1,$2,$3,$4)`,
    [userId, kind, title, body]
  );
}
