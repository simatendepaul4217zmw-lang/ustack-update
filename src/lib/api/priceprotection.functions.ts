import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryOne, execute } from "../db/index.server";
import { verifyToken } from "../auth.server";

export const getPriceProtection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    const pp = await queryOne<{ enabled: boolean; threshold_pct: number }>(
      `SELECT enabled, threshold_pct FROM price_protection WHERE user_id=$1`,
      [payload.sub]
    );
    return pp ?? { enabled: false, threshold_pct: 20 };
  });

export const updatePriceProtection = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    token: z.string(),
    enabled: z.boolean(),
    thresholdPct: z.number().int().min(1).max(50),
  }))
  .handler(async ({ data }) => {
    const payload = await verifyToken(data.token);
    if (!payload) throw new Error("Unauthorized");

    await execute(
      `UPDATE price_protection SET enabled=$1, threshold_pct=$2, updated_at=NOW() WHERE user_id=$3`,
      [data.enabled, data.thresholdPct, payload.sub]
    );
    return { ok: true };
  });
