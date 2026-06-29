import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Fingerprint, Check, ArrowLeft, Lock, AlertCircle, Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { PinPad } from "../PinPad";
import { useSetupPin, useChangePin, useSetBiometric, useSecurityStatus } from "@/lib/hooks/useAppData";
import { isNative, isBiometricAvailable, registerWebBiometric, tryBiometricAuth, hapticSuccess } from "@/lib/native";

type Mode = "setup" | "change";
type Step = "enter" | "confirm" | "current" | "new" | "confirmNew" | "biometric" | "done";

interface SecuritySetupSheetProps {
  open: boolean;
  onClose: () => void;
  mode?: Mode;
  startAt?: "pin" | "biometric";
}

export function SecuritySetupSheet({ open, onClose, mode = "setup", startAt = "pin" }: SecuritySetupSheetProps) {
  const { data: security, refetch } = useSecurityStatus();
  const setupPin = useSetupPin();
  const changePin = useChangePin();
  const setBiometric = useSetBiometric();

  const [step, setStep] = useState<Step>("enter");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");

  // Biometric setup state
  const [bioChecking, setBioChecking] = useState(false);
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);
  const [bioRegistering, setBioRegistering] = useState(false);
  const [bioError, setBioError] = useState("");

  const isChange = mode === "change" || security?.pinEnabled;

  useEffect(() => {
    if (!open) {
      setPin(""); setFirstPin(""); setCurrentPin(""); setError("");
      setBioError(""); setBioAvailable(null);
      setStep(startAt === "biometric" ? "biometric" : isChange ? "current" : "enter");
    } else {
      setStep(startAt === "biometric" ? "biometric" : isChange ? "current" : "enter");
    }
  }, [open, isChange, startAt]);

  // When landing on biometric step, check availability
  useEffect(() => {
    if (step !== "biometric") return;
    setBioChecking(true);
    setBioError("");
    isBiometricAvailable().then((avail) => {
      setBioAvailable(avail);
      setBioChecking(false);
    });
  }, [step]);

  const close = () => { onClose(); };
  const back = () => {
    setPin(""); setError("");
    setStep(isChange ? "current" : "enter");
  };

  const handleCurrentComplete = async (entered: string) => {
    setCurrentPin(entered);
    setError("");
    setPin(""); setStep("new");
  };

  const handleNewComplete = (entered: string) => {
    setFirstPin(entered);
    setError("");
    setPin(""); setStep(isChange ? "confirmNew" : "confirm");
  };

  const handleConfirmComplete = async (entered: string) => {
    const ref = isChange ? firstPin : firstPin || pin;
    if (entered !== ref) {
      setError("PINs don't match — try again");
      setPin("");
      setStep(isChange ? "new" : "enter");
      setFirstPin("");
      return;
    }
    setError("");
    try {
      if (isChange) {
        await changePin.mutateAsync({ currentPin, newPin: entered });
      } else {
        await setupPin.mutateAsync({ pin: entered });
      }
      await refetch();
      setStep("biometric");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save PIN");
      setPin("");
      setStep(isChange ? "current" : "enter");
    }
  };

  const handleEnableBiometric = async () => {
    setBioError("");
    setBioRegistering(true);

    try {
      let registered = false;

      if (isNative) {
        // On native, just try a biometric auth to confirm it works
        registered = await tryBiometricAuth("Register your fingerprint for UStack");
      } else {
        // On web, register a WebAuthn credential
        registered = await registerWebBiometric();
      }

      if (!registered) {
        setBioError("Fingerprint not recognised. Try again or skip.");
        setBioRegistering(false);
        return;
      }

      await hapticSuccess();
      await setBiometric.mutateAsync({ enabled: true });
      await refetch();
      setStep("done");
    } catch {
      setBioError("Failed to enable fingerprint. Please try again.");
    } finally {
      setBioRegistering(false);
    }
  };

  const handleDisableBiometric = async () => {
    try {
      await setBiometric.mutateAsync({ enabled: false });
      await refetch();
      setStep("done");
    } catch {
      setStep("done");
    }
  };

  const isPinPending = setupPin.isPending || changePin.isPending;

  const stepTitles: Partial<Record<Step, string>> = {
    enter: "Create PIN",
    confirm: "Confirm PIN",
    current: "Change PIN",
    new: "New PIN",
    confirmNew: "Confirm new PIN",
    biometric: "Fingerprint",
    done: isChange ? "PIN Updated" : "Security Set Up",
  };

  return (
    <Sheet open={open} onClose={close} title={stepTitles[step] ?? "Security"}>
      <AnimatePresence mode="wait">

        {/* Enter new PIN (setup) */}
        {step === "enter" && (
          <motion.div key="enter" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-2 pt-2">
            <div className="w-14 h-14 rounded-2xl bg-card border border-white/8 flex items-center justify-center mb-2" style={{ color: "oklch(0.82 0.17 140)" }}>
              <Lock className="w-7 h-7" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">Choose a 4-digit PIN to secure your account</p>
            <PinPad pin={pin} onChange={setPin} onComplete={handleNewComplete} error={error} disabled={isPinPending} />
          </motion.div>
        )}

        {/* Confirm PIN (setup) */}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-2 pt-2">
            <button onClick={back} className="flex items-center gap-1 text-xs text-muted-foreground self-start mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <p className="text-sm text-muted-foreground text-center mb-4">Re-enter your PIN to confirm it</p>
            <PinPad pin={pin} onChange={setPin} onComplete={handleConfirmComplete} error={error} disabled={isPinPending} />
          </motion.div>
        )}

        {/* Current PIN (change mode) */}
        {step === "current" && (
          <motion.div key="current" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-2 pt-2">
            <p className="text-sm text-muted-foreground text-center mb-4">Enter your current PIN to continue</p>
            <PinPad pin={pin} onChange={setPin} onComplete={handleCurrentComplete} error={error} disabled={isPinPending} />
          </motion.div>
        )}

        {/* New PIN (change mode) */}
        {step === "new" && (
          <motion.div key="new" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-2 pt-2">
            <p className="text-sm text-muted-foreground text-center mb-4">Choose your new 4-digit PIN</p>
            <PinPad pin={pin} onChange={setPin} onComplete={handleNewComplete} error={error} disabled={isPinPending} />
          </motion.div>
        )}

        {/* Confirm new PIN (change mode) */}
        {step === "confirmNew" && (
          <motion.div key="confirmNew" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-2 pt-2">
            <button onClick={() => { setPin(""); setStep("new"); }} className="flex items-center gap-1 text-xs text-muted-foreground self-start mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <p className="text-sm text-muted-foreground text-center mb-4">Confirm your new PIN</p>
            <PinPad pin={pin} onChange={setPin} onComplete={handleConfirmComplete} error={error} disabled={isPinPending} />
          </motion.div>
        )}

        {/* Biometric setup */}
        {step === "biometric" && (
          <motion.div key="biometric" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-5 pt-4 text-center">

            {bioChecking ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Checking fingerprint support…</p>
              </div>
            ) : bioAvailable === false ? (
              /* Not available on this device */
              <>
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-muted-foreground">
                  <Fingerprint className="w-10 h-10" />
                </div>
                <div>
                  <div className="text-lg font-semibold mb-2">Not Available</div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    Fingerprint isn't supported on this device or browser. You can use your PIN to stay secure.
                  </p>
                </div>
                <button onClick={() => setStep("done")} className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">
                  Continue with PIN
                </button>
              </>
            ) : (
              /* Available — offer to enable */
              <>
                {/* Animated fingerprint */}
                <div className="relative flex items-center justify-center">
                  {!bioRegistering && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute w-24 h-24 rounded-full border border-primary/30"
                    />
                  )}
                  <div
                    className="w-24 h-24 rounded-[2rem] bg-card border border-white/8 flex items-center justify-center"
                    style={{ color: "oklch(0.82 0.17 140)" }}
                  >
                    {bioRegistering
                      ? <Loader2 className="w-10 h-10 animate-spin" />
                      : <Fingerprint className="w-10 h-10" />
                    }
                  </div>
                </div>

                <div>
                  <div className="text-lg font-semibold mb-2">
                    {security?.biometricEnabled ? "Fingerprint Active" : "Enable Fingerprint?"}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {security?.biometricEnabled
                      ? "Your fingerprint is set up. You can disable it here or keep it active."
                      : "Use your fingerprint to unlock the app and confirm transfers — no PIN needed."}
                  </p>
                </div>

                {bioError && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive w-full text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {bioError}
                  </div>
                )}

                <div className="flex flex-col gap-3 w-full mt-1">
                  {security?.biometricEnabled ? (
                    <>
                      <button
                        onClick={handleDisableBiometric}
                        disabled={setBiometric.isPending || bioRegistering}
                        className="w-full flex items-center justify-center gap-2 glass border border-white/10 text-destructive font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40"
                      >
                        Disable Fingerprint
                      </button>
                      <button onClick={() => setStep("done")} className="w-full py-4 rounded-2xl glass text-sm font-medium text-muted-foreground">
                        Keep enabled
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleEnableBiometric}
                        disabled={setBiometric.isPending || bioRegistering}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40"
                      >
                        <Fingerprint className="w-5 h-5" />
                        {bioRegistering ? "Setting up…" : "Enable Fingerprint"}
                      </button>
                      <button onClick={() => setStep("done")} className="w-full py-4 rounded-2xl glass text-sm font-medium text-muted-foreground">
                        Skip for now
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 py-10 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }} className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.86 0.13 160)" }}>
              <ShieldCheck className="w-10 h-10" />
            </motion.div>
            <div>
              <div className="text-xl font-semibold">{isChange ? "PIN updated!" : "You're protected!"}</div>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                {isChange
                  ? "Your PIN has been changed successfully."
                  : "All fund movements now require your PIN or fingerprint."}
              </p>
            </div>
            <div className="w-full rounded-2xl bg-card border border-white/8 p-4 text-left flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary shrink-0" /> 4-digit PIN secured</div>
              {security?.biometricEnabled && (
                <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary shrink-0" /> Fingerprint unlock active</div>
              )}
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary shrink-0" /> Withdrawals protected</div>
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary shrink-0" /> Vault transfers protected</div>
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary shrink-0" /> 5 failed attempts = 30 min lock</div>
            </div>
            <button onClick={close} className="mt-2 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">
              Done
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </Sheet>
  );
}
