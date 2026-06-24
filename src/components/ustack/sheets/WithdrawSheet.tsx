import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Smartphone, AlertTriangle, Lock, TrendingUp,
  ChevronRight, ArrowLeft, CheckCircle2, Wallet, LayoutGrid,
  ClipboardPaste, X as XIcon, Loader2, Link2, ShieldCheck
} from "lucide-react";
import { Sheet } from "./Sheet";
import { fmtSats, type Vault } from "@/lib/ustack-data";
import { useCurrency } from "@/lib/currency-context";
import { useWallet, useVaults, useWithdrawFromVault, useSendPayment, useSendOnChainPayment, useEstimateOnChainFee, useBtcPrice, useVerifyPin, useSecurityStatus } from "@/lib/hooks/useAppData";
import { ACCENT_COLORS, VaultIcon } from "@/lib/vault-theme";
import { PinPad } from "../PinPad";

type Step = "source" | "vault" | "locked" | "amount" | "warning" | "auth" | "done";
type Source = "balance" | "vault";
type Method = "lightning" | "momo" | "onchain";

const PROVIDERS = ["Airtel", "MTN MoMo", "Zamtel"];

export function WithdrawSheet({
  open, onClose, vaultContext,
}: {
  open: boolean;
  onClose: () => void;
  vaultContext?: Vault | null;
}) {
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<Source>("balance");
  const [vault, setVault] = useState<Vault | null>(null);
  const [method, setMethod] = useState<Method>("lightning");
  const [provider, setProvider] = useState("MTN MoMo");
  const [address, setAddress] = useState("");
  const [onchainAddress, setOnchainAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [pendingAfterAuth, setPendingAfterAuth] = useState<"withdraw" | "warning" | null>(null);

  const { data: wallet } = useWallet();
  const { data: vaults = [] } = useVaults();
  const { data: btcPrice } = useBtcPrice();
  const priceZmw = btcPrice?.priceZmw;
  const { fmtValue } = useCurrency();
  const withdrawFromVault = useWithdrawFromVault();
  const sendPayment = useSendPayment();
  const sendOnChain = useSendOnChainPayment();
  const feeQuery = useEstimateOnChainFee(onchainAddress, Number(amount) || 0);
  const { data: security } = useSecurityStatus();
  const verifyPin = useVerifyPin();

  const availableSats = wallet?.availableSats ?? 0;

  useEffect(() => {
    if (open && vaultContext) {
      setSource("vault"); setVault(vaultContext);
      // Only hodl vaults that are still time-locked are completely blocked
      if (vaultContext.type === "hodl" && vaultContext.locked) setStep("locked");
      else { setAmount(String(Math.floor(vaultContext.currentSats * 0.1))); setStep("amount"); }
    } else if (!open) {
      resetAll();
    }
  }, [open, vaultContext]);

  const resetAll = () => {
    setStep("source"); setSource("balance"); setVault(null);
    setAddress(""); setOnchainAddress(""); setPhone(""); setAmount(""); setError("");
    setAuthPin(""); setAuthError(""); setPendingAfterAuth(null);
  };

  const requireAuth = (after: "withdraw" | "warning") => {
    if (security?.pinEnabled || security?.biometricEnabled) {
      setPendingAfterAuth(after);
      setAuthPin(""); setAuthError("");
      setStep("auth");
    } else if (after === "warning") {
      setStep("warning");
    } else {
      handleWithdraw();
    }
  };

  const handleAuthComplete = async (pin: string) => {
    setAuthError("");
    try {
      await verifyPin.mutateAsync({ pin });
      if (pendingAfterAuth === "warning") setStep("warning");
      else handleWithdraw();
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "Incorrect PIN");
      setAuthPin("");
    }
  };

  const reset = () => { resetAll(); onClose(); };

  const selectSource = (s: Source) => {
    setSource(s);
    if (s === "balance") { setVault(null); setAmount(""); setStep("amount"); }
    else setStep("vault");
  };

  const selectVault = (v: Vault) => {
    setVault(v);
    // Only hodl vaults that are still time-locked are completely blocked
    if (v.type === "hodl" && v.locked) setStep("locked");
    else { setAmount(String(Math.floor(v.currentSats * 0.1))); setStep("amount"); }
  };

  const maxAmount = source === "balance" ? availableSats : (vault?.currentSats ?? 0);
  const pct = vault ? vault.currentSats / vault.goalSats : 0;
  const penaltyPct = vault?.penaltyPct ?? 45;
  // Penalty only applies to stack vaults that haven't reached their goal.
  // Hodl vaults are either completely blocked (locked) or free (expired).
  const isEarly = source === "vault" && vault?.type === "stack" && pct < 1;
  const penalty = isEarly ? Math.floor((Number(amount) || 0) * penaltyPct / 100) : 0;
  const receiveAmount = Number(amount) - penalty;

  const isValidOnchain = (addr: string) =>
    /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(addr.trim());

  const isValidLightning = (s: string) => {
    const t = s.trim().toLowerCase();
    return (
      t.startsWith("lnbc") ||
      t.startsWith("lntb") ||
      t.startsWith("lnurl") ||
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)  // Lightning Address
    );
  };

  const feeSats = feeQuery.data?.feeSats ?? 0;
  const amountBelowFee = method === "onchain" && feeSats > 0 && Number(amount) > 0 && Number(amount) <= feeSats;

  const canContinue = () => {
    if (!amount || Number(amount) <= 0 || Number(amount) > maxAmount) return false;
    if (method === "lightning" && !isValidLightning(address)) return false;
    if (method === "momo" && phone.trim().length < 9) return false;
    if (method === "onchain" && !isValidOnchain(onchainAddress)) return false;
    if (amountBelowFee) return false;
    return true;
  };

  const handleWithdraw = async () => {
    setError("");
    try {
      if (source === "vault" && vault) {
        await withdrawFromVault.mutateAsync({ vaultId: vault.id, amountSats: Number(amount) });
      } else if (source === "balance" && method === "lightning") {
        await sendPayment.mutateAsync({ paymentRequest: address.trim(), amountSats: Number(amount) });
      } else if (source === "balance" && method === "onchain") {
        await sendOnChain.mutateAsync({ address: onchainAddress.trim(), amountSats: Number(amount) });
      } else if (source === "balance" && method === "momo") {
        await sendPayment.mutateAsync({ paymentRequest: `momo:${phone.trim()}`, amountSats: Number(amount) });
      }
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    }
  };

  const isPending = withdrawFromVault.isPending || sendPayment.isPending || sendOnChain.isPending;

  const methodLabel = method === "lightning" ? "Lightning" : method === "onchain" ? "On-chain" : "Mobile Money";

  const titleMap: Record<Step, string | undefined> = {
    source: "Transfer", vault: "Select Vault", locked: vault?.name,
    amount: vaultContext ? vaultContext.name : (source === "balance" ? "Available Balance" : vault?.name),
    warning: "Early Transfer", auth: "Authorize Transfer", done: "Transfer Sent",
  };

  return (
    <Sheet open={open} onClose={reset} title={titleMap[step]}>
      <AnimatePresence mode="wait">

        {/* Step 1: Source picker */}
        {step === "source" && (
          <motion.div key="source" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm text-muted-foreground mb-5">Where would you like to transfer from?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => selectSource("balance")} className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10">
                <div className="w-12 h-12 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color: "oklch(0.82 0.17 140)" }}><Wallet className="w-6 h-6" /></div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Available Balance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Available: <span className="text-foreground font-medium">{fmtSats(availableSats)} sats</span></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
              <button onClick={() => selectSource("vault")} className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10">
                <div className="w-12 h-12 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color: "oklch(0.73 0.19 55)" }}><LayoutGrid className="w-6 h-6" /></div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">From a Vault</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{vaults.length} vault{vaults.length !== 1 ? "s" : ""} available</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2a: Vault picker */}
        {step === "vault" && (
          <motion.div key="vault" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep("source")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <p className="text-sm text-muted-foreground mb-4">Choose which vault to transfer from.</p>
            <div className="flex flex-col gap-2">
              {vaults.map((v) => {
                const p = v.currentSats / v.goalSats;
                const hodlLocked = v.type === "hodl" && v.locked;
                const stackEarly = v.type === "stack" && p < 1;
                const pctLabel = p > 0 && Math.round(p * 100) === 0 ? "<1%" : `${Math.round(p * 100)}%`;
                return (
                  <button key={v.id} onClick={() => selectVault(v)} className="flex items-center gap-3 rounded-2xl glass p-4 text-left transition active:scale-[0.98]">
                    <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${ACCENT_COLORS[v.accent] ?? ACCENT_COLORS.btc}20`, color: ACCENT_COLORS[v.accent] ?? ACCENT_COLORS.btc }}><VaultIcon name={v.emoji} className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{v.name}</span>
                        {hodlLocked && (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground shrink-0">
                            <Lock className="w-2.5 h-2.5" /> Hodl locked
                          </span>
                        )}
                        {stackEarly && !hodlLocked && (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[oklch(0.73_0.19_55)]/15 text-[oklch(0.85_0.15_55)] shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5" /> 45% fee
                          </span>
                        )}
                        {!hodlLocked && !stackEarly && (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-[oklch(0.82_0.13_190)] bg-[oklch(0.82_0.13_190)]/10 shrink-0">
                            <TrendingUp className="w-2.5 h-2.5" /> Free
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtSats(v.currentSats)} · {pctLabel} of goal</div>
                      <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(p * 100, 100)}%`, background: ACCENT_COLORS[v.accent] ?? ACCENT_COLORS.btc }} />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2b: Hodl locked — no exit */}
        {step === "locked" && vault && (
          <motion.div key="locked" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.73 0.19 55)" }}><Lock className="w-8 h-8" /></div>
              <div className="text-base font-semibold">Hodl Vault: No Early Exit</div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{vault.name}</span> is time-locked. There is no early exit, not even with a fee. Sats stay locked until the period ends.
              </div>
              <div className="w-full rounded-xl bg-white/5 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Days remaining</span>
                <span className="text-sm font-semibold">{vault.daysRemaining} days</span>
              </div>
              <p className="text-xs text-muted-foreground">That's the point. Future you will be grateful. 🔐</p>
            </div>
            <button onClick={vaultContext ? reset : () => setStep("vault")} className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">Got it, Keep Hodling</button>
          </motion.div>
        )}

        {/* Step 3: Method + amount */}
        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => vaultContext ? reset() : (source === "balance" ? setStep("source") : setStep("vault"))} className="flex items-center gap-1 text-xs text-muted-foreground mb-5"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            {vault && (
              <div className="rounded-2xl p-4 bg-card border border-white/8 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Transferring from</span>
                  <span className="font-semibold text-foreground">{vault.name}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Available</span><span>{fmtSats(vault.currentSats)} sats</span>
                </div>
              </div>
            )}
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Transfer method</div>
            <div className="grid grid-cols-3 gap-2 mb-6">
              <MethodCard active={method === "lightning"} onClick={() => setMethod("lightning")} icon={Zap} label="Lightning" sub="Instant" />
              <MethodCard active={method === "momo"} onClick={() => setMethod("momo")} icon={Smartphone} label="Mobile Money" sub="2–5 min" />
              <MethodCard active={method === "onchain"} onClick={() => setMethod("onchain")} icon={Link2} label="On-chain" sub="~10 min" />
            </div>

            <AnimatePresence mode="wait">
              {method === "lightning" && (
                <motion.div key="ln-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Lightning invoice or address</div>
                    <div className="rounded-2xl glass p-4 flex items-start gap-3">
                      <Zap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="lnbc... or user@wallet.com" rows={3} className="flex-1 bg-transparent text-sm focus:outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed" />
                      {address ? (
                        <button onClick={() => setAddress("")} className="text-muted-foreground hover:text-foreground shrink-0"><XIcon className="w-3.5 h-3.5" /></button>
                      ) : (
                        <button onClick={async () => { try { setAddress(await navigator.clipboard.readText()); } catch {} }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground shrink-0">
                          <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                        </button>
                      )}
                    </div>
                  </div>
                  <AmountField amount={amount} setAmount={setAmount} maxAmount={maxAmount} />
                  {isEarly && <EarlyWarningBadge pct={pct} penaltyPct={penaltyPct} />}
                  {error && <p className="text-sm text-destructive text-center">{error}</p>}
                  <button disabled={!canContinue() || isPending} onClick={() => requireAuth(isEarly ? "warning" : "withdraw")} className={`w-full font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2 ${isEarly ? "bg-[oklch(0.73_0.19_55)]/20 text-[oklch(0.85_0.15_55)] border border-[oklch(0.73_0.19_55)]/30" : "bg-primary text-primary-foreground"}`}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEarly ? `Tap Out (${penaltyPct}% fee)` : "Continue"}
                  </button>
                </motion.div>
              )}

              {method === "momo" && (
                <motion.div key="momo-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">Mobile Money Coming Soon</div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                      We are working on mobile money support. Airtel, MTN MoMo, and Zamtel Kwacha withdrawals will be available very soon.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Use Lightning or On-chain to transfer your sats for now.</p>
                  <button onClick={() => setMethod("lightning")} className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">
                    Use Lightning instead
                  </button>
                </motion.div>
              )}

              {method === "onchain" && (
                <motion.div key="onchain-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Bitcoin address</div>
                    <div className="rounded-2xl glass p-4 flex items-start gap-3">
                      <Link2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <textarea value={onchainAddress} onChange={(e) => setOnchainAddress(e.target.value.trim())} placeholder="bc1q... or 1... or 3..." rows={2} className="flex-1 bg-transparent text-sm focus:outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed font-mono" />
                      {onchainAddress ? (
                        <button onClick={() => setOnchainAddress("")} className="text-muted-foreground hover:text-foreground shrink-0"><XIcon className="w-3.5 h-3.5" /></button>
                      ) : (
                        <button onClick={async () => { try { setOnchainAddress((await navigator.clipboard.readText()).trim()); } catch {} }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground shrink-0">
                          <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                        </button>
                      )}
                    </div>
                    {onchainAddress.length > 5 && !isValidOnchain(onchainAddress) && (
                      <p className="mt-1.5 text-xs text-destructive pl-1">Invalid Bitcoin address format</p>
                    )}
                  </div>
                  <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border ${amountBelowFee ? "bg-destructive/10 border-destructive/30" : "bg-white/5 border-white/10"}`}>
                    <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${amountBelowFee ? "text-destructive" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">On-chain transfers confirm in ~10 minutes. A network fee will be deducted from the amount.</p>
                      {feeQuery.data && !amountBelowFee && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Estimated fee: <span className="text-foreground font-medium">{feeQuery.data.feeSats.toLocaleString()} sats</span>
                          {" · "}You receive: <span className="text-foreground font-medium">{(Number(amount) - feeQuery.data.feeSats).toLocaleString()} sats</span>
                        </p>
                      )}
                      {amountBelowFee && (
                        <p className="text-xs text-destructive mt-1 font-medium">
                          Amount must exceed the network fee ({feeSats.toLocaleString()} sats). Increase your withdrawal amount.
                        </p>
                      )}
                      {feeQuery.isFetching && <p className="text-xs text-muted-foreground mt-1">Estimating fee…</p>}
                    </div>
                  </div>
                  <AmountField amount={amount} setAmount={setAmount} maxAmount={maxAmount} />
                  {isEarly && <EarlyWarningBadge pct={pct} penaltyPct={penaltyPct} />}
                  {error && <p className="text-sm text-destructive text-center">{error}</p>}
                  <button disabled={!canContinue() || isPending} onClick={() => requireAuth(isEarly ? "warning" : "withdraw")} className={`w-full font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2 ${isEarly ? "bg-[oklch(0.73_0.19_55)]/20 text-[oklch(0.85_0.15_55)] border border-[oklch(0.73_0.19_55)]/30" : "bg-primary text-primary-foreground"}`}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEarly ? `Tap Out (${penaltyPct}% fee)` : "Continue"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Auth step: PIN verification */}
        {step === "auth" && (
          <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center gap-4 pt-2">
            <button onClick={() => setStep("amount")} className="flex items-center gap-1 text-xs text-muted-foreground self-start mb-1"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <div className="w-14 h-14 rounded-2xl bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.82 0.17 140)" }}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <p className="text-sm text-muted-foreground text-center">Enter your PIN to authorize this transfer</p>
            <PinPad pin={authPin} onChange={setAuthPin} onComplete={handleAuthComplete} error={authError} disabled={verifyPin.isPending} />
          </motion.div>
        )}

        {/* Step 4: Tap-out penalty confirmation */}
        {step === "warning" && vault && (
          <motion.div key="warning" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-[oklch(0.73_0.19_55)]/30 bg-[oklch(0.73_0.19_55)]/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-[oklch(0.73_0.19_55)]" />
                <div className="text-sm font-semibold">Tap-Out Penalty</div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Your <span className="text-foreground font-semibold">{vault.name}</span> vault hasn't reached its goal yet. Tapping out early costs you {penaltyPct}%, designed to keep you from spending what you're saving.
              </p>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex justify-between"><span>Withdrawal amount</span><span className="text-foreground font-semibold">{fmtSats(Number(amount))}</span></div>
                <div className="flex justify-between text-[oklch(0.85_0.15_55)]"><span>Tap-out penalty ({penaltyPct}%)</span><span className="font-semibold">−{fmtSats(penalty)}</span></div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between"><span>You receive</span><span className="text-foreground font-semibold">{fmtSats(receiveAmount)}</span></div>
              </div>
              <div className="mt-4 rounded-xl bg-white/5 px-3 py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Goal progress</span>
                <span className="font-semibold">{pct > 0 && Math.round(pct * 100) === 0 ? "<1" : Math.round(pct * 100)}% of {vault.goalSats.toLocaleString()} sats</span>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStep("amount")} className="flex-1 glass py-4 rounded-2xl font-semibold text-sm">Stay the course</button>
              <button disabled={isPending} onClick={handleWithdraw} className="flex-1 bg-[oklch(0.73_0.19_55)]/20 text-[oklch(0.85_0.15_55)] border border-[oklch(0.73_0.19_55)]/30 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tap out anyway"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center gap-4 py-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }} className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.82 0.17 140)" }}>
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            <div className="text-lg font-semibold">Transfer Initiated</div>
            <div className="text-sm text-muted-foreground"><span className="text-foreground font-semibold">{fmtSats(receiveAmount)}</span> is on its way via {methodLabel}.</div>
            <div className="w-full rounded-2xl glass p-4 text-left flex flex-col gap-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Source</span><span className="text-foreground font-medium">{source === "balance" ? "Available Balance" : vault?.name}</span></div>
              <div className="flex justify-between"><span>Method</span><span className="text-foreground font-medium">
                {method === "lightning" ? "Lightning" : method === "onchain" ? "On-chain Bitcoin" : `${provider} (Mobile Money)`}
              </span></div>
              {method === "onchain" && (
                <div className="flex justify-between gap-4"><span className="shrink-0">Address</span><span className="text-foreground font-mono text-[10px] truncate">{onchainAddress}</span></div>
              )}
              <div className="h-px bg-white/10" />
              <div className="flex justify-between"><span>Amount</span><span className="text-foreground font-medium">{fmtSats(receiveAmount)}</span></div>
              {method === "onchain" && (
                <div className="flex justify-between"><span>Est. time</span><span className="text-foreground font-medium">~10 minutes</span></div>
              )}
            </div>
            <button onClick={reset} className="mt-2 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">Done</button>
          </motion.div>
        )}

      </AnimatePresence>
    </Sheet>
  );
}

function AmountField({ amount, setAmount, maxAmount }: { amount: string; setAmount: (v: string) => void; maxAmount: number }) {
  const { fmtValue } = useCurrency();
  const { data: btcPriceAmt } = useBtcPrice();
  const priceZmwAmt = btcPriceAmt?.priceZmw;
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amount</div>
      <div className="rounded-2xl glass p-5 flex items-center justify-center gap-2">
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="bg-transparent text-3xl font-semibold text-center tabular-nums focus:outline-none w-44" placeholder="0" />
        <span className="text-sm text-muted-foreground">sats</span>
      </div>
      {Number(amount) > 0 && <div className="mt-1 text-center text-xs font-medium text-foreground/70 tabular-nums">{fmtValue(Number(amount), priceZmwAmt)}</div>}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Available: <span className="text-foreground font-semibold">{fmtSats(maxAmount)}</span></span>
        <button onClick={() => setAmount(String(maxAmount))} className="text-[oklch(0.82_0.13_190)] font-semibold text-[10px] uppercase tracking-wider">Max</button>
      </div>
    </div>
  );
}

function EarlyWarningBadge({ pct, penaltyPct }: { pct: number; penaltyPct: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[oklch(0.73_0.19_55)]/10 border border-[oklch(0.73_0.19_55)]/20 px-3 py-2">
      <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.73_0.19_55)] shrink-0" />
      <span className="text-xs text-muted-foreground">Vault at <span className="text-foreground font-semibold">{Math.round(pct * 100)}%</span>. Early withdrawal applies a {penaltyPct}% penalty.</span>
    </div>
  );
}

function MethodCard({ active, onClick, icon: Icon, label, sub }: { active: boolean; onClick: () => void; icon: typeof Zap; label: string; sub: string }) {
  return (
    <button onClick={onClick} className={`rounded-2xl p-3 flex flex-col items-start gap-2 text-left transition border ${active ? "bg-card border-primary/50" : "bg-card/50 border-transparent"}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={active ? { background: "oklch(0.73 0.19 55)", color: "white" } : { background: "oklch(1 0 0 / 0.05)" }}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs font-semibold leading-tight">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </button>
  );
}
