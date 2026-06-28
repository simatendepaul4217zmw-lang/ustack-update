import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, ShieldCheck, Lock } from "lucide-react";
import { Sheet } from "./Sheet";
import { PinPad } from "../PinPad";
import { useVerifyPin, useSecurityStatus } from "@/lib/hooks/useAppData";

interface PinEntrySheetProps {
  open: boolean;
  onClose: () => void;
  onAuthorized: (txAuthToken: string) => void;
  title?: string;
  description?: string;
}

export function PinEntrySheet({ open, onClose, onAuthorized, title = "Confirm", description = "Enter your PIN to continue" }: PinEntrySheetProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { data: security } = useSecurityStatus();
  const verifyPin = useVerifyPin();

  useEffect(() => {
    if (!open) { setPin(""); setError(""); }
  }, [open]);

  const handleComplete = async (entered: string) => {
    setError("");
    try {
      const result = await verifyPin.mutateAsync({ pin: entered });
      onAuthorized(result.txAuthToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Incorrect PIN");
      setPin("");
    }
  };

  if (security?.locked) {
    const mins = Math.ceil((security.lockSecondsRemaining ?? 0) / 60);
    return (
      <Sheet open={open} onClose={onClose} title="Account Locked">
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <div className="text-lg font-semibold">Too many attempts</div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Transfers are locked for {mins} more minute{mins !== 1 ? "s" : ""} due to multiple failed PIN attempts.
          </p>
          <button onClick={onClose} className="mt-4 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">
            Got it
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <AnimatePresence mode="wait">
        <motion.div key="pin-entry" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-card border border-white/8 flex items-center justify-center mb-2" style={{ color: "oklch(0.82 0.17 140)" }}>
            <ShieldCheck className="w-7 h-7" />
          </div>

          <p className="text-sm text-muted-foreground text-center mb-4">{description}</p>

          <PinPad
            pin={pin}
            onChange={setPin}
            onComplete={handleComplete}
            error={error}
            disabled={verifyPin.isPending}
          />

          {security?.biometricEnabled && (
            <button
              onClick={() => {
                // On Capacitor native, trigger biometric auth
                // On web, just show message
                setError("Biometric auth is available in the mobile app.");
              }}
              className="mt-2 flex items-center gap-2 text-sm text-muted-foreground py-3 px-5 rounded-2xl glass"
            >
              <Fingerprint className="w-5 h-5" style={{ color: "oklch(0.82 0.17 140)" }} />
              Use fingerprint instead
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}
