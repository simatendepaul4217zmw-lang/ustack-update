import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query, queryOne, execute } from "../db/index.server";
import { generateOtp, signAccessToken, signRefreshToken, verifyToken } from "../auth.server";
import { sendOtpEmail } from "./resend.server";

export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    // Purge all expired or used OTPs globally on every request (housekeeping)
    await execute(`DELETE FROM otp_codes WHERE expires_at < NOW() OR used = true`, []);

    const recent = await query<{ count: string }>(
      `SELECT COUNT(*) FROM otp_codes WHERE email=$1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [email]
    );
    if (parseInt(recent[0].count) >= 5) {
      throw new Error("Too many OTP requests. Try again in an hour.");
    }

    // Delete any pending unused OTPs for this email before issuing a new one
    await execute(`DELETE FROM otp_codes WHERE email=$1`, [email]);

    const code = generateOtp();
    await execute(
      `INSERT INTO otp_codes(email, code, expires_at) VALUES($1, $2, NOW() + INTERVAL '5 minutes')`,
      [email, code]
    );

    await sendOtpEmail(email, code);

    return { sent: true };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), code: z.string(), username: z.string().optional() }))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    const otp = await queryOne<{ id: string; code: string; expires_at: string; used: boolean }>(
      `SELECT * FROM otp_codes WHERE email=$1 AND used=false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (!otp || otp.code !== data.code) throw new Error("Invalid or expired code.");

    // Delete immediately — OTPs are single-use, no reason to keep them
    await execute(`DELETE FROM otp_codes WHERE email=$1`, [email]);

    let user = await queryOne<{ id: string; username: string; email: string }>(
      `SELECT id, username, email FROM users WHERE email=$1`,
      [email]
    );

    if (!user) {
      if (!data.username?.trim()) throw new Error("Username required for new account.");
      const username = data.username.trim();

      const existing = await queryOne(`SELECT id FROM users WHERE username=$1`, [username]);
      if (existing) throw new Error("Username already taken.");

      user = await queryOne<{ id: string; username: string; email: string }>(
        `INSERT INTO users(username, email) VALUES($1, $2) RETURNING id, username, email`,
        [username, email]
      );

      await execute(`INSERT INTO wallets(user_id) VALUES($1)`, [user!.id]);
      const initials = username.slice(0, 2).toUpperCase();
      await execute(
        `INSERT INTO profiles(user_id, display_name, avatar_initials) VALUES($1, $2, $3)`,
        [user!.id, username, initials]
      );
      await execute(`INSERT INTO price_protection(user_id) VALUES($1)`, [user!.id]);
    }

    const accessToken = await signAccessToken({ sub: user!.id, username: user!.username, email: user!.email });
    const refreshToken = await signRefreshToken(user!.id);

    await execute(
      `INSERT INTO sessions(user_id, refresh_token, expires_at) VALUES($1, $2, NOW() + INTERVAL '30 days')`,
      [user!.id, refreshToken]
    );

    return { accessToken, refreshToken, user: { id: user!.id, username: user!.username, email: user!.email } };
  });

export const refreshAccessToken = createServerFn({ method: "POST" })
  .inputValidator(z.object({ refreshToken: z.string() }))
  .handler(async ({ data }) => {
    const session = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM sessions WHERE refresh_token=$1 AND expires_at > NOW()`,
      [data.refreshToken]
    );
    if (!session) throw new Error("Invalid or expired session.");

    const user = await queryOne<{ id: string; username: string; email: string }>(
      `SELECT id, username, email FROM users WHERE id=$1`,
      [session.user_id]
    );
    if (!user) throw new Error("User not found.");

    const accessToken = await signAccessToken({ sub: user.id, username: user.username, email: user.email });
    return { accessToken };
  });

export const getMe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const user = await queryOne<{ id: string; username: string; email: string }>(
      `SELECT id, username, email FROM users WHERE id=$1`,
      [payload.sub]
    );
    if (!user) throw new Error("User not found");

    const profile = await queryOne<{
      display_name: string; avatar_initials: string; avatar_color: string;
      profile_picture_url: string | null; biometric_enabled: boolean; notification_preferences: object;
    }>(
      `SELECT display_name, avatar_initials, avatar_color, profile_picture_url, biometric_enabled, notification_preferences FROM profiles WHERE user_id=$1`,
      [user.id]
    );

    return { user, profile };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    displayName: z.string().optional(),
    avatarColor: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    if (data.displayName) {
      await execute(
        `UPDATE profiles SET display_name=$1, updated_at=NOW() WHERE user_id=$2`,
        [data.displayName, payload.sub]
      );
    }
    if (data.avatarColor) {
      await execute(
        `UPDATE profiles SET avatar_color=$1, updated_at=NOW() WHERE user_id=$2`,
        [data.avatarColor, payload.sub]
      );
    }
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ refreshToken: z.string() }))
  .handler(async ({ data }) => {
    await execute(`DELETE FROM sessions WHERE refresh_token=$1`, [data.refreshToken]);
    return { ok: true };
  });
