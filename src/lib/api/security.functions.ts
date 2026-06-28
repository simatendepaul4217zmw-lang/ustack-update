import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyToken } from "../auth.server";
import { execute, queryOne } from "../db/index.server";
import { signTxAuthToken, verifyTxAuthToken as _verifyTxAuthToken, hashPin, verifyPinHash } from "../security.server";

export { _verifyTxAuthToken as verifyTxAuthToken };

export const getSecurityStatus = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const profile = await queryOne<{
      transaction_pin_enabled: boolean;
      biometric_enabled: boolean;
      failed_pin_attempts: number;
      transaction_lock_until: string | null;
    }>(
      `SELECT transaction_pin_enabled, biometric_enabled, failed_pin_attempts, transaction_lock_until
       FROM profiles WHERE user_id=$1`,
      [payload.sub]
    );

    const locked = profile?.transaction_lock_until
      ? new Date(profile.transaction_lock_until) > new Date()
      : false;

    return {
      pinEnabled: profile?.transaction_pin_enabled ?? false,
      biometricEnabled: profile?.biometric_enabled ?? false,
      locked,
      lockSecondsRemaining: locked && profile?.transaction_lock_until
        ? Math.ceil((new Date(profile.transaction_lock_until).getTime() - Date.now()) / 1000)
        : 0,
      failedAttempts: profile?.failed_pin_attempts ?? 0,
    };
  });

export const setupPin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), pin: z.string().length(4).regex(/^\d{4}$/) }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const hash = await hashPin(data.pin);
    await execute(
      `UPDATE profiles SET
        transaction_pin_hash=$1,
        transaction_pin_enabled=TRUE,
        transaction_pin_created_at=COALESCE(transaction_pin_created_at, NOW()),
        transaction_pin_updated_at=NOW(),
        failed_pin_attempts=0,
        transaction_lock_until=NULL,
        updated_at=NOW()
       WHERE user_id=$2`,
      [hash, payload.sub]
    );
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'security','PIN set up','{}')`,
      [payload.sub]
    );
    return { ok: true };
  });

export const changePin = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    currentPin: z.string().length(4),
    newPin: z.string().length(4).regex(/^\d{4}$/),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const profile = await queryOne<{
      transaction_pin_hash: string | null;
      transaction_lock_until: string | null;
      failed_pin_attempts: number;
    }>(
      `SELECT transaction_pin_hash, transaction_lock_until, failed_pin_attempts FROM profiles WHERE user_id=$1`,
      [payload.sub]
    );

    if (!profile?.transaction_pin_hash) throw new Error("No PIN set");

    if (profile.transaction_lock_until && new Date(profile.transaction_lock_until) > new Date()) {
      const mins = Math.ceil((new Date(profile.transaction_lock_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${mins} minute(s).`);
    }

    const valid = await verifyPinHash(data.currentPin, profile.transaction_pin_hash);
    if (!valid) {
      const attempts = (profile.failed_pin_attempts ?? 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await execute(`UPDATE profiles SET failed_pin_attempts=$1, transaction_lock_until=$2 WHERE user_id=$3`, [attempts, lockUntil, payload.sub]);
      } else {
        await execute(`UPDATE profiles SET failed_pin_attempts=$1 WHERE user_id=$2`, [attempts, payload.sub]);
      }
      throw new Error("Incorrect PIN");
    }

    const hash = await hashPin(data.newPin);
    await execute(
      `UPDATE profiles SET transaction_pin_hash=$1, transaction_pin_updated_at=NOW(), failed_pin_attempts=0, transaction_lock_until=NULL, updated_at=NOW() WHERE user_id=$2`,
      [hash, payload.sub]
    );
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'security','PIN changed','{}')`,
      [payload.sub]
    );
    return { ok: true };
  });

// Unlock the app after timeout — verifies PIN but does NOT log "Transaction authorized"
export const unlockWithPin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), pin: z.string().length(4).regex(/^\d{4}$/) }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const profile = await queryOne<{
      transaction_pin_hash: string | null;
      transaction_lock_until: string | null;
      failed_pin_attempts: number;
    }>(
      `SELECT transaction_pin_hash, transaction_lock_until, failed_pin_attempts FROM profiles WHERE user_id=$1`,
      [payload.sub]
    );

    if (profile?.transaction_lock_until && new Date(profile.transaction_lock_until) > new Date()) {
      const mins = Math.ceil((new Date(profile.transaction_lock_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${mins} minute(s).`);
    }

    if (!profile?.transaction_pin_hash) throw new Error("No PIN configured. Set up a PIN first.");

    const valid = await verifyPinHash(data.pin, profile.transaction_pin_hash);
    if (!valid) {
      const attempts = (profile.failed_pin_attempts ?? 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await execute(`UPDATE profiles SET failed_pin_attempts=$1, transaction_lock_until=$2 WHERE user_id=$3`, [attempts, lockUntil, payload.sub]);
        throw new Error("Too many incorrect attempts. Locked for 30 minutes.");
      }
      await execute(`UPDATE profiles SET failed_pin_attempts=$1 WHERE user_id=$2`, [attempts, payload.sub]);
      throw new Error(`Incorrect PIN. ${5 - attempts} attempt(s) left.`);
    }

    await execute(`UPDATE profiles SET failed_pin_attempts=0, transaction_lock_until=NULL WHERE user_id=$1`, [payload.sub]);
    return { ok: true };
  });

export const verifyPin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), pin: z.string().length(4).regex(/^\d{4}$/) }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const profile = await queryOne<{
      transaction_pin_hash: string | null;
      transaction_lock_until: string | null;
      failed_pin_attempts: number;
    }>(
      `SELECT transaction_pin_hash, transaction_lock_until, failed_pin_attempts FROM profiles WHERE user_id=$1`,
      [payload.sub]
    );

    if (profile?.transaction_lock_until && new Date(profile.transaction_lock_until) > new Date()) {
      const mins = Math.ceil((new Date(profile.transaction_lock_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${mins} minute(s).`);
    }

    if (!profile?.transaction_pin_hash) throw new Error("No PIN configured. Set up a PIN first.");

    const valid = await verifyPinHash(data.pin, profile.transaction_pin_hash);
    if (!valid) {
      const attempts = (profile.failed_pin_attempts ?? 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await execute(`UPDATE profiles SET failed_pin_attempts=$1, transaction_lock_until=$2 WHERE user_id=$3`, [attempts, lockUntil, payload.sub]);
        throw new Error("Too many incorrect attempts. Locked for 30 minutes.");
      }
      await execute(`UPDATE profiles SET failed_pin_attempts=$1 WHERE user_id=$2`, [attempts, payload.sub]);
      throw new Error(`Incorrect PIN. ${5 - attempts} attempt(s) left.`);
    }

    await execute(`UPDATE profiles SET failed_pin_attempts=0, transaction_lock_until=NULL WHERE user_id=$1`, [payload.sub]);
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'security','Transaction authorized','{}')`,
      [payload.sub]
    );

    const txAuthToken = await signTxAuthToken(payload.sub);
    return { ok: true, txAuthToken };
  });

export const setBiometric = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string(), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    await execute(`UPDATE profiles SET biometric_enabled=$1, updated_at=NOW() WHERE user_id=$2`, [data.enabled, payload.sub]);
    await execute(
      `INSERT INTO activity_logs(user_id, action, title, meta) VALUES($1,'security',$2,'{}')`,
      [payload.sub, data.enabled ? "Biometric enabled" : "Biometric disabled"]
    );
    return { ok: true };
  });
