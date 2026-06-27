import { query, queryOne, execute } from "../db/index.server";
import { getTreasuryState, initTreasuryState, swapBtcToUsd, swapUsdToBtc, type TreasuryState } from "./treasury.server";

const THRESHOLD_PCT = 0.02; // 2%
const CONFIRMATION_MS = 5 * 60 * 1000; // 5 minutes

async function notifyAllUsers(type: "protect" | "recover") {
  const title = type === "protect" ? "Savings Protected 🛡️" : "Back in Bitcoin ⚡";
  const body = type === "protect"
    ? "Bitcoin dropped 2%. UStack moved treasury funds to USD protection."
    : "Bitcoin recovered. UStack moved treasury funds back into Bitcoin.";

  await execute(
    `INSERT INTO notifications (user_id, kind, title, body)
     SELECT u.id, 'price_protection', $1, $2
     FROM users u
     JOIN price_protection pp ON pp.user_id = u.id
     WHERE pp.enabled = true`,
    [title, body]
  );
}

async function logActivity(action: string, title: string, meta: Record<string, unknown>) {
  await execute(
    `INSERT INTO activity_logs(user_id, action, title, meta)
     VALUES (NULL, $1, $2, $3::jsonb)`,
    [action, title, JSON.stringify(meta)]
  );
}

async function recordTransition(
  state: TreasuryState,
  toMode: "btc" | "usd",
  triggerPrice: number,
  blinkTxId: string
) {
  await execute(
    `INSERT INTO treasury_transitions(from_mode, to_mode, trigger_price, reference_price, blink_tx_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [state.current_mode, toMode, triggerPrice, state.reference_price_usd, blinkTxId]
  );
}

async function executeProtect(state: TreasuryState, currentPrice: number) {
  console.log(`[protection] Executing PROTECT — price $${currentPrice.toFixed(2)}, dropped from $${state.reference_price_usd}`);

  let blinkTxId = "error";
  try {
    await logActivity("treasury_protection_executing", "Treasury Protection Executing", { current_price: currentPrice });
    blinkTxId = await swapBtcToUsd();
  } catch (err) {
    console.error("[protection] swapBtcToUsd failed:", err);
    await logActivity("treasury_protection_failed", "Treasury Protection Failed", {
      error: String(err), current_price: currentPrice,
    });
    await execute(
      `UPDATE treasury_state SET pending_action = NULL, pending_started_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [state.id]
    );
    return;
  }

  await execute(
    `UPDATE treasury_state SET
       current_mode = 'usd',
       pending_action = NULL,
       pending_started_at = NULL,
       last_transition_at = NOW(),
       last_transition_price = $1,
       updated_at = NOW()
     WHERE id = $2`,
    [currentPrice, state.id]
  );

  await recordTransition(state, "usd", currentPrice, blinkTxId);
  await notifyAllUsers("protect");
  await logActivity("treasury_converted_to_usd", "Treasury Moved to USD Protection", {
    trigger_price: currentPrice,
    reference_price: state.reference_price_usd,
    blink_tx_id: blinkTxId,
  });

  console.log("[protection] ✅ Treasury protected in USD");
}

async function executeRecover(state: TreasuryState, currentPrice: number) {
  console.log(`[protection] Executing RECOVER — price $${currentPrice.toFixed(2)}`);

  let blinkTxId = "error";
  try {
    await logActivity("treasury_recovery_executing", "Treasury Recovery Executing", { current_price: currentPrice });
    blinkTxId = await swapUsdToBtc();
  } catch (err) {
    console.error("[protection] swapUsdToBtc failed:", err);
    await logActivity("treasury_recovery_failed", "Treasury Recovery Failed", {
      error: String(err), current_price: currentPrice,
    });
    await execute(
      `UPDATE treasury_state SET pending_action = NULL, pending_started_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [state.id]
    );
    return;
  }

  const newReference = currentPrice;
  const newProtection = newReference * (1 - THRESHOLD_PCT);

  await execute(
    `UPDATE treasury_state SET
       current_mode = 'btc',
       reference_price_usd = $1,
       protection_price_usd = $2,
       pending_action = NULL,
       pending_started_at = NULL,
       last_transition_at = NOW(),
       last_transition_price = $3,
       updated_at = NOW()
     WHERE id = $4`,
    [newReference, newProtection, currentPrice, state.id]
  );

  await recordTransition(state, "btc", currentPrice, blinkTxId);
  await notifyAllUsers("recover");
  await logActivity("treasury_converted_to_btc", "Treasury Recovered to Bitcoin", {
    recovery_price: currentPrice,
    new_reference: newReference,
    blink_tx_id: blinkTxId,
  });

  console.log("[protection] ✅ Treasury recovered to BTC, new reference $" + newReference.toFixed(2));
}

export async function evaluateProtection(currentPriceUsd: number): Promise<void> {
  try {
    let state = await getTreasuryState();

    // First boot — initialise with today's price
    if (!state) {
      state = await initTreasuryState(currentPriceUsd);
      return; // no evaluation needed on init tick
    }

    const referencePrice = Number(state.reference_price_usd);
    const protectionPrice = Number(state.protection_price_usd);
    const now = Date.now();

    // --- Update rolling high-water mark (only moves up) ---
    if (currentPriceUsd > referencePrice && state.current_mode === "btc") {
      const newProtection = currentPriceUsd * (1 - THRESHOLD_PCT);
      await execute(
        `UPDATE treasury_state SET
           reference_price_usd = $1,
           protection_price_usd = $2,
           updated_at = NOW()
         WHERE id = $3`,
        [currentPriceUsd, newProtection, state.id]
      );
      // Reload
      state = await getTreasuryState() as TreasuryState;
    }

    // --- BTC MODE: watch for drop ---
    if (state.current_mode === "btc") {
      if (currentPriceUsd <= protectionPrice) {
        if (!state.pending_action) {
          // Start confirmation timer
          await execute(
            `UPDATE treasury_state SET pending_action = 'protect', pending_started_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [state.id]
          );
          await logActivity("treasury_protection_timer_started", "Protection Confirmation Started", {
            current_price: currentPriceUsd,
            protection_price: protectionPrice,
          });
          console.log(`[protection] ⏱ Protection timer started at $${currentPriceUsd.toFixed(2)}`);
        } else if (state.pending_action === "protect" && state.pending_started_at) {
          const elapsed = now - new Date(state.pending_started_at).getTime();
          if (elapsed >= CONFIRMATION_MS) {
            await executeProtect(state, currentPriceUsd);
          } else {
            const remaining = Math.ceil((CONFIRMATION_MS - elapsed) / 1000);
            console.log(`[protection] ⏱ Protection confirming... ${remaining}s remaining`);
          }
        }
      } else {
        // Price recovered above protection line — cancel pending
        if (state.pending_action === "protect") {
          await execute(
            `UPDATE treasury_state SET pending_action = NULL, pending_started_at = NULL, updated_at = NOW()
             WHERE id = $1`,
            [state.id]
          );
          console.log("[protection] Protection timer cancelled — price recovered");
        }
      }
    }

    // --- USD MODE: watch for recovery ---
    if (state.current_mode === "usd") {
      if (currentPriceUsd > protectionPrice) {
        if (!state.pending_action) {
          // Start recovery timer
          await execute(
            `UPDATE treasury_state SET pending_action = 'recover', pending_started_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [state.id]
          );
          await logActivity("treasury_recovery_timer_started", "Recovery Confirmation Started", {
            current_price: currentPriceUsd,
            protection_price: protectionPrice,
          });
          console.log(`[protection] ⏱ Recovery timer started at $${currentPriceUsd.toFixed(2)}`);
        } else if (state.pending_action === "recover" && state.pending_started_at) {
          const elapsed = now - new Date(state.pending_started_at).getTime();
          if (elapsed >= CONFIRMATION_MS) {
            await executeRecover(state, currentPriceUsd);
          } else {
            const remaining = Math.ceil((CONFIRMATION_MS - elapsed) / 1000);
            console.log(`[protection] ⏱ Recovery confirming... ${remaining}s remaining`);
          }
        }
      } else {
        // Price dropped again — cancel recovery
        if (state.pending_action === "recover") {
          await execute(
            `UPDATE treasury_state SET pending_action = NULL, pending_started_at = NULL, updated_at = NOW()
             WHERE id = $1`,
            [state.id]
          );
          console.log("[protection] Recovery timer cancelled — price dropped again");
        }
      }
    }
  } catch (err) {
    console.error("[protection] evaluateProtection error:", err);
  }
}
