import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, CheckCircle2 } from "lucide-react";
import { tryBiometricAuth, hapticSuccess, hapticWarning } from "@/lib/native";

interface BiometricPromptProps {
  reason?: string;
  onSuccess: () => void;
  onFallback: () => void;
  showPinFallback?: boolean;
}

export function BiometricPrompt({
  reason = "Confirm with fingerprint",
  onSuccess,
  onFallback,
  showPinFallback = true,
}: BiometricPromptProps) {
  const [state, setState] = useState<"scanning" | "success" | "failed">("scanning");

  const attempt = useCallback(async () => {
    setState("scanning");
    const ok = await tryBiometricAuth(reason);
    if (ok) {
      await hapticSuccess();
      setState("success");
      setTimeout(onSuccess, 700);
    } else {
      await hapticWarning();
      setState("failed");
    }
  }, [reason, onSuccess]);

  useEffect(() => {
    const t = setTimeout(attempt, 200);
    return () => clearTimeout(t);
  }, [attempt]);

  const iconColor =
    state === "success"
      ? "oklch(0.82 0.17 140)"
      : state === "failed"
      ? "oklch(0.65 0.2 25)"
      : "oklch(0.82 0.17 140)";

  return (
    <div className="flex flex-col items-center gap-7 py-6 text-center">
      {/* Fingerprint icon with pulse rings */}
      <div className="relative flex items-center justify-center">
        {state === "scanning" && (
          <>
            <motion.div
              animate={{ scale: [1, 1.6, 1], opacity: [0.35, 0, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-28 h-28 rounded-full border border-primary/30"
            />
            <motion.div
              animate={{ scale: [1, 2.1, 1], opacity: [0.18, 0, 0.18] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
              className="absolute w-28 h-28 rounded-full border border-primary/20"
            />
          </>
        )}

        <motion.button
          onClick={state === "failed" ? attempt : undefined}
          animate={
            state === "failed"
              ? { x: [0, -8, 8, -8, 8, -4, 4, 0] }
              : state === "success"
              ? { scale: [1, 1.12, 1] }
              : {}
          }
          transition={{ duration: state === "failed" ? 0.45 : 0.35 }}
          whileTap={state === "failed" ? { scale: 0.94 } : {}}
          className="relative w-28 h-28 rounded-[2rem] glass border border-white/10 flex items-center justify-center transition-colors"
          style={{ color: iconColor }}
        >
          <AnimatePresence mode="wait">
            {state === "success" ? (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <CheckCircle2 className="w-14 h-14" />
              </motion.div>
            ) : (
              <motion.div
                key="fp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Fingerprint
                  className="w-14 h-14"
                  style={{
                    filter: state === "scanning"
                      ? "drop-shadow(0 0 8px oklch(0.82 0.17 140 / 0.5))"
                      : "none",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Status text */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col items-center gap-1.5"
        >
          <p className="text-base font-semibold">
            {state === "scanning"
              ? "Touch the sensor"
              : state === "success"
              ? "Verified!"
              : "Not recognised"}
          </p>
          <p className="text-sm text-muted-foreground">
            {state === "scanning"
              ? "Place your finger to confirm"
              : state === "success"
              ? "Fingerprint confirmed"
              : "Tap the fingerprint to try again"}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* PIN fallback */}
      {showPinFallback && state !== "success" && (
        <button
          onClick={onFallback}
          className="text-sm text-muted-foreground underline underline-offset-4 active:opacity-60 transition"
        >
          Use PIN instead
        </button>
      )}
    </div>
  );
}
