import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import { PinPad } from "./PinPad";
import { useUnlockWithPin, useSecurityStatus } from "@/lib/hooks/useAppData";
import { tryBiometricAuth } from "@/lib/native";

interface AppLockProps {
  onUnlocked: () => void;
}

export function AppLock({ onUnlocked }: AppLockProps) {
  const { data: security } = useSecurityStatus();
  const unlockPin = useUnlockWithPin();

  const [mode, setMode] = useState<"biometric" | "pin">("biometric");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [biometricFailed, setBiometricFailed] = useState(false);
  const [biometricTried, setBiometricTried] = useState(false);

  const attemptBiometric = useCallback(async () => {
    if (!security?.biometricEnabled) return;
    setBiometricTried(true);
    const ok = await tryBiometricAuth("Unlock UStack");
    if (ok) {
      onUnlocked();
    } else {
      setBiometricFailed(true);
      if (security?.pinEnabled) setMode("pin");
    }
  }, [security, onUnlocked]);

  useEffect(() => {
    if (!security) return;

    if (!security.pinEnabled && !security.biometricEnabled) {
      onUnlocked();
      return;
    }

    if (security.biometricEnabled && !biometricTried) {
      attemptBiometric();
    } else if (!security.biometricEnabled && security.pinEnabled) {
      setMode("pin");
    }
  }, [security, biometricTried, attemptBiometric, onUnlocked]);

  const handlePinComplete = async (entered: string) => {
    setError("");
    try {
      await unlockPin.mutateAsync({ pin: entered });
      onUnlocked();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Incorrect PIN");
      setPin("");
    }
  };

  if (security?.locked) {
    const mins = Math.ceil((security.lockSecondsRemaining ?? 0) / 60);
    return (
      <LockScreen>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <p className="text-lg font-semibold">Account Locked</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Too many failed attempts. Try again in {mins} minute{mins !== 1 ? "s" : ""}.
          </p>
        </div>
      </LockScreen>
    );
  }

  return (
    <LockScreen>
      <AnimatePresence mode="wait">
        {mode === "biometric" && security?.biometricEnabled && !biometricFailed ? (
          <motion.div
            key="biometric"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <motion.button
              onClick={attemptBiometric}
              whileTap={{ scale: 0.92 }}
              className="w-24 h-24 rounded-3xl glass border border-white/10 flex items-center justify-center"
              style={{ color: "oklch(0.82 0.17 140)" }}
            >
              <Fingerprint className="w-12 h-12" />
            </motion.button>
            <div>
              <p className="text-base font-semibold text-foreground">Touch to unlock</p>
              <p className="text-sm text-muted-foreground mt-1">Use your fingerprint to open UStack</p>
            </div>
            {security.pinEnabled && (
              <button
                onClick={() => setMode("pin")}
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                Use PIN instead
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col items-center w-full h-full"
          >
            {/* Spacer pushes everything down */}
            <div className="flex-1" />

            {/* Icon + text — sits just above numpad */}
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

            {/* Numpad */}
            <div className="pb-10 w-full">
              <PinPad
                pin={pin}
                onChange={setPin}
                onComplete={handlePinComplete}
                error={error}
                disabled={unlockPin.isPending}
                onBiometric={security?.biometricEnabled ? () => { setBiometricFailed(false); setMode("biometric"); setTimeout(attemptBiometric, 100); } : undefined}
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
      className="absolute inset-0 z-[200] bg-background flex flex-col items-center px-8"
    >
      {children}
    </motion.div>
  );
}
