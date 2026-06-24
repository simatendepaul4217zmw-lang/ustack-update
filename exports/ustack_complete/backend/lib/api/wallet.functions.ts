import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query, queryOne, execute } from "../db/index.server";
import { verifyToken } from "../auth.server";

export const getWallet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const wallet = await queryOne<{
      available_sats: string;
      vault_sats: string;
      locked_vault_sats: string;
      open_vault_sats: string;
    }>(
      `SELECT w.available_sats, w.vault_sats,
       COALESCE(SUM(CASE
         WHEN v.vault_type = 'hodl' AND v.locked_until > NOW() THEN v.current_sats
         WHEN v.vault_type = 'stack' AND v.current_sats < v.goal_sats THEN v.current_sats
         ELSE 0
       END), 0)::bigint AS locked_vault_sats,
       COALESCE(SUM(CASE
         WHEN v.vault_type = 'hodl' AND (v.locked_until IS NULL OR v.locked_until <= NOW()) THEN v.current_sats
         WHEN v.vault_type = 'stack' AND v.current_sats >= v.goal_sats THEN v.current_sats
         ELSE 0
       END), 0)::bigint AS open_vault_sats
       FROM wallets w
       LEFT JOIN vaults v ON v.user_id = w.user_id AND v.status = 'active'
       WHERE w.user_id = $1
       GROUP BY w.available_sats, w.vault_sats`,
      [payload.sub]
    );
    if (!wallet) throw new Error("Wallet not found");

    return {
      availableSats: Number(wallet.available_sats),
      vaultSats: Number(wallet.vault_sats),
      lockedVaultSats: Number(wallet.locked_vault_sats),
      openVaultSats: Number(wallet.open_vault_sats),
      totalSats: Number(wallet.available_sats) + Number(wallet.vault_sats),
    };
  });

export async function creditWallet(userId: string, amountSats: number): Promise<void> {
  await execute(
    `UPDATE wallets SET available_sats = available_sats + $1, updated_at = NOW() WHERE user_id = $2`,
    [amountSats, userId]
  );
}

export async function creditVault(userId: string, vaultId: string, amountSats: number): Promise<void> {
  await execute(
    `UPDATE wallets SET vault_sats = vault_sats + $1, updated_at = NOW() WHERE user_id = $2`,
    [amountSats, userId]
  );
  await execute(
    `UPDATE vaults SET current_sats = current_sats + $1,
     last_deposit_at = NOW(),
     streak_days = CASE WHEN last_deposit_at > NOW() - INTERVAL '48 hours' THEN streak_days + 1 ELSE 1 END,
     updated_at = NOW()
     WHERE id = $2 AND user_id = $3 AND status = 'active'`,
    [amountSats, vaultId, userId]
  );
}

export async function lockIntoVault(userId: string, amountSats: number): Promise<void> {
  const wallet = await queryOne<{ available_sats: string }>(
    `SELECT available_sats FROM wallets WHERE user_id=$1 FOR UPDATE`,
    [userId]
  );
  if (!wallet || Number(wallet.available_sats) < amountSats) {
    throw new Error("Insufficient available balance.");
  }
  await execute(
    `UPDATE wallets SET available_sats = available_sats - $1, vault_sats = vault_sats + $1, updated_at = NOW() WHERE user_id = $2`,
    [amountSats, userId]
  );
}

export async function unlockFromVault(userId: string, amountSats: number): Promise<void> {
  await execute(
    `UPDATE wallets SET vault_sats = vault_sats - $1, available_sats = available_sats + $1, updated_at = NOW() WHERE user_id = $2`,
    [amountSats, userId]
  );
}
