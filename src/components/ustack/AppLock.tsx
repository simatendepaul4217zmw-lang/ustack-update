import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Fingerprint, CheckCircle2 } from "lucide-react";
import { PinPad } from "./PinPad";
import { useUnlockWithPin, useSecurityStatus } from "@/lib/hooks/useAppData";
import { tryBiometricAuth, hapticSuccess, hapticWarning } from "@/lib/native";

interface AppLockProps {
  onUnlocked: () => void;
}

export function AppLock({ onUnlocked }: AppLockProps) {
  const { data: security } = useSecurityStatus();
  const unlockPin = useUnlockWithPin();

  const [mode, setMode] = useState<"biometric" | "pin">("biometric");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [biometricTried, setBiometricTried] = useState(false);
  const [bioState, setBioState] = useState<"idle" | "scanning" | "success" | "failed">("idle");

  const attemptBiometric = useCallback(async () => {
    setBioState("scanning");
    setBiometricTried(true);
    const ok = await tryBiometricAuth("Unlock UStack");
    if (ok) {
      await hapticSuccess();
      setBioState("success");
      setTimeout(onUnlocked, 650);
    } else {
      await hapticWarning();
      setBioState("failed");
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (!security) return;

    if (!security.pinEnabled && !security.biometricEnabled) {
      onUnlocked();
      return;
    }

    if (security.biometricEnabled && !biometricTried) {
      setMode("biometric");
      attemptBiometric();
    } else if (!security.biometricEnabled && security.pinEnabled) {
      setMode("pin");
    }
  }, [security, biometricTried, attemptBiometric, onUnlocked]);

  const handlePinComplete = async (entered: string) => {
    setError("");
    try {
      await unlockPin.mutateAsync({ pin: entered });
      await hapticSuccess();
      onUnlocked();
    } catch (e: unknown) {
      await hapticWarning();
      setError(e instanceof Error ? e.message : "Incorrect PIN");
      setPin("");
    }
  };

  const switchToPin = () => {
    setBioState("idle");
    setMode("pin");
  };

  const retryBiometric = () => {
    setBioState("idle");
    setTimeout(attemptBiometric, 80);
  };

  // Locked-out state
  if (security?.locked) {
    const mins = Math.ceil((security.lockSecondsRemaining ?? 0) / 60);
    return (
      <LockScreen>
        <div className="flex flex-col items-center gap-5 text-center px-8">
          <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-semibold mb-1">Account Locked</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Too many failed attempts. Try again in{" "}
              <span className="text-foreground font-medium">{mins} minute{mins !== 1 ? "s" : ""}</span>.
            </p>
          </div>
        </div>
      </LockScreen>
    );
  }

  return (
    <LockScreen>
      <AnimatePresence mode="wait">

        {/* ── Biometric mode ── */}
        {mode === "biometric" && security?.biometricEnabled && (
          <motion.div
            key="biometric"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-8 text-center"
          >
            {/* Logo */}
            <span className="text-base font-black tracking-tight" style={{ color: "oklch(0.82 0.17 140)" }}>
              UStack
            </span>

            {/* Fingerprint icon with rings */}
            <div className="relative flex items-center justify-center">
              {bioState === "scanning" && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.6, 1], opacity: [0.35, 0, 0.35] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute w-32 h-32 rounded-full border border-primary/30"
                  />
                  <motion.div
                    animate={{ scale: [1, 2.2, 1], opacity: [0.15, 0, 0.15] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                    className="absolute w-32 h-32 rounded-full border border-primary/15"
                  />
                </>
              )}

              <motion.button
                onClick={bioState === "failed" ? retryBiometric : undefined}
                animate={
                  bioState === "failed"
                    ? { x: [0, -8, 8, -8, 8, 0] }
                    : bioState === "success"
                    ? { scale: [1, 1.1, 1] }
                    : {}
                }
                transition={{ duration: bioState === "failed" ? 0.4 : 0.3 }}
                whileTap={bioState === "failed" ? { scale: 0.93 } : {}}
                className="relative w-32 h-32 rounded-[2.5rem] glass border border-white/10 flex items-center justify-center"
                style={{
                  color:
                    bioState === "success"
                      ? "oklch(0.82 0.17 140)"
                      : bioState === "failed"
                      ? "oklch(0.65 0.2 25)"
                      : "oklch(0.82 0.17 140)",
                }}
              >
                <AnimatePresence mode="wait">
                  {bioState === "success" ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 16 }}
                    >
                      <CheckCircle2 className="w-16 h-16" />
                    </motion.div>
                  ) : (
                    <motion.div key="fp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Fingerprint
                        className="w-16 h-16"
                        style={bioState === "scanning" ? { filter: "drop-shadow(0 0 10px oklch(0.82 0.17 140 / 0.5))" } : {}}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            {/* Status */}
            <AnimatePresence mode="wait">
              <motion.div
                key={bioState}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex flex-col items-center gap-1.5"
              >
                <p className="text-lg font-semibold">
                  {bioState === "scanning"
                    ? "Touch to unlock"
                    : bioState === "success"
                    ? "Unlocked!"
                    : "Try again"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {bioState === "scanning"
                    ? "Use your fingerprint to open UStack"
                    : bioState === "success"
                    ? "Welcome back"
                    : "Fingerprint not recognised — tap to retry"}
                </p>
              </motion.div>
            </AnimatePresence>

            {security.pinEnabled && bioState !== "success" && (
              <button
                onClick={switchToPin}
                className="text-sm text-muted-foreground underline underline-offset-4 active:opacity-60 transition"
              >
                Use PIN instead
              </button>
            )}
          </motion.div>
        )}

        {/* ── PIN mode ── */}
        {mode === "pin" && (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center w-full h-full"
          >
            <div className="pt-12 w-full flex justify-center">
              <span className="text-lg font-black tracking-tight" style={{ color: "oklch(0.82 0.17 140)" }}>
                UStack
              </span>
            </div>

            <div className="flex-1" />

            <div className="flex flex-col items-center gap-2 mb-8">
              <div
                className="w-14 h-14 rounded-2xl bg-card border border-white/8 flex items-center justify-center"
                style={{ color: "oklch(0.82 0.17 140)" }}
              >
                <Lock className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold mt-2">Enter your PIN</p>
              <p className="text-sm text-muted-foreground">Enter your 4-digit PIN to unlock</p>
            </div>

            <div className="pb-10 w-full">
              <PinPad
                pin={pin}
                onChange={setPin}
                onComplete={handlePinComplete}
                error={error}
                disabled={unlockPin.isPending}
                onBiometric={
                  security?.biometricEnabled
                    ? () => {
                        setMode("biometric");
                        setBioState("idle");
                        setTimeout(attemptBiometric, 120);
                      }
                    : undefined
                }
              />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </LockScreen>
  );
}

function LockScreen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-[200] bg-background flex flex-col items-center justify-center px-8"
    >
      {children}
    </motion.div>
  );
}
