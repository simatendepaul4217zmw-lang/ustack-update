import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Smartphone, AlertTriangle, Lock, TrendingUp,
  ChevronRight, ArrowLeft, CheckCircle2, Wallet, LayoutGrid,
  ClipboardPaste, X as XIcon
} from "lucide-react";
import { Sheet } from "./Sheet";
import { vaults, availableSats, fmtSats, type Vault } from "@/lib/ustack-data";

type Step = "source" | "vault" | "locked" | "amount" | "warning" | "done";
type Source = "balance" | "vault";

const accentGrad: Record<string, string> = {
  coral: "grad-coral", teal: "grad-teal", mint: "grad-mint", aqua: "grad-teal", btc: "grad-btc",
};
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
  const [method, setMethod] = useState<"lightning" | "momo">("lightning");
  const [provider, setProvider] = useState("MTN MoMo");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open && vaultContext) {
      setSource("vault");
      setVault(vaultContext);
      if (vaultContext.type === "hodl" && vaultContext.locked) {
        setStep("locked");
      } else {
        setAmount(String(Math.floor(vaultContext.currentSats * 0.1)));
        setStep("amount");
      }
    } else if (!open) {
      setStep("source");
      setSource("balance");
      setVault(null);
      setAddress("");
      setPhone("");
      setAmount("");
    }
  }, [open, vaultContext]);

  const reset = () => {
    setStep("source");
    setSource("balance");
    setVault(null);
    setAddress("");
    setPhone("");
    setAmount("");
    onClose();
  };

  const selectSource = (s: Source) => {
    setSource(s);
    if (s === "balance") { setVault(null); setAmount(""); setStep("amount"); }
    else setStep("vault");
  };

  const selectVault = (v: Vault) => {
    setVault(v);
    if (v.type === "hodl" && v.locked) setStep("locked");
    else { setAmount(String(Math.floor(v.currentSats * 0.1))); setStep("amount"); }
  };

  const maxAmount = source === "balance" ? availableSats : (vault?.currentSats ?? 0);
  const pct = vault ? vault.currentSats / vault.goalSats : 0;
  const isEarly = source === "vault" && pct < 1;
  const penalty = Math.floor((Number(amount) || 0) * 0.025);
  const receiveAmount = Number(amount) - (isEarly ? penalty : 0);

  const backFromAmount = () => {
    if (vaultContext) { reset(); return; }
    source === "balance" ? setStep("source") : setStep("vault");
  };

  const canContinue = () => {
    if (!amount || Number(amount) <= 0 || Number(amount) > maxAmount) return false;
    if (method === "lightning" && address.trim().length < 6) return false;
    if (method === "momo" && phone.trim().length < 9) return false;
    return true;
  };

  const titleMap: Record<Step, string | undefined> = {
    source: "Withdraw",
    vault: "Select Vault",
    locked: vault?.name,
    amount: vaultContext ? vaultContext.name : (source === "balance" ? "Main Balance" : vault?.name),
    warning: "Early Withdrawal",
    done: "Withdrawal Sent",
  };

  return (
    <Sheet open={open} onClose={reset} title={titleMap[step]}>
      <AnimatePresence mode="wait">

        {/* Step 1: Source picker */}
        {step === "source" && (
          <motion.div key="source" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm text-muted-foreground mb-5">Where would you like to withdraw from?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => selectSource("balance")}
                className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10"
              >
                <div className="w-12 h-12 rounded-xl grad-teal flex items-center justify-center shrink-0">
                  <Wallet className="w-6 h-6 text-background" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Main Balance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Available: <span className="text-foreground font-medium">{fmtSats(availableSats)} sats</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              <button
                onClick={() => selectSource("vault")}
                className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10"
              >
                <div className="w-12 h-12 rounded-xl grad-coral flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-6 h-6 text-background" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">From a Vault</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {vaults.length} vault{vaults.length !== 1 ? "s" : ""} available
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2a: Vault picker */}
        {step === "vault" && (
          <motion.div key="vault" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep("source")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <p className="text-sm text-muted-foreground mb-4">Choose which vault to withdraw from.</p>
            <div className="flex flex-col gap-2">
              {vaults.map((v) => {
                const p = v.currentSats / v.goalSats;
                return (
                  <button key={v.id} onClick={() => selectVault(v)} className="flex items-center gap-3 rounded-2xl glass p-4 text-left transition active:scale-[0.98]">
                    <div className={`w-11 h-11 rounded-xl ${accentGrad[v.accent]} flex items-center justify-center shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{v.name}</span>
                        {v.type === "hodl" && v.locked && (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground shrink-0">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                        {v.type === "stack" && (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-[oklch(0.82_0.13_190)] bg-[oklch(0.82_0.13_190)]/10 shrink-0">
                            <TrendingUp className="w-2.5 h-2.5" /> Stack
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtSats(v.currentSats)} · {Math.round(p * 100)}% of goal</div>
                      <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full ${accentGrad[v.accent]} rounded-full`} style={{ width: `${Math.min(p * 100, 100)}%` }} />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2b: Locked vault */}
        {step === "locked" && vault && (
          <motion.div key="locked" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {vaultContext && (
              <div className={`rounded-2xl p-4 ${accentGrad[vault.accent]} relative overflow-hidden mb-5`}>
                <div className="absolute inset-0 bg-background/60 backdrop-blur-xl" />
                <div className="relative text-xs text-muted-foreground flex items-center justify-between">
                  <span>Vault</span>
                  <span className="font-semibold text-foreground">{vault.name}</span>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl grad-coral flex items-center justify-center">
                <Lock className="w-8 h-8 text-background" />
              </div>
              <div className="text-base font-semibold">This vault is locked</div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{vault.name}</span> is a Hodl Vault. Sats are time-locked and cannot be withdrawn until the lock period expires.
              </div>
              <div className="w-full rounded-xl bg-white/5 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Days remaining</span>
                <span className="text-sm font-semibold">{vault.daysRemaining} days</span>
              </div>
              <div className="w-full rounded-xl bg-white/5 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-sm font-semibold">{Math.round(pct * 100)}% of goal</span>
              </div>
              <p className="text-xs text-muted-foreground">Stay disciplined. Future you will be grateful.</p>
            </div>
            <button
              onClick={vaultContext ? reset : () => setStep("vault")}
              className="mt-5 w-full flex items-center justify-center gap-2 grad-teal text-primary-foreground font-semibold py-4 rounded-2xl"
            >
              Keep Stacking
            </button>
            {!vaultContext && (
              <button onClick={() => setStep("vault")} className="mt-3 w-full text-muted-foreground text-sm py-2 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to vaults
              </button>
            )}
          </motion.div>
        )}

        {/* Step 3: Method, address & amount */}
        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={backFromAmount} className="flex items-center gap-1 text-xs text-muted-foreground mb-5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {/* Vault badge when coming from vault detail */}
            {vault && (
              <div className={`rounded-2xl p-4 ${accentGrad[vault.accent]} relative overflow-hidden mb-5`}>
                <div className="absolute inset-0 bg-background/60 backdrop-blur-xl" />
                <div className="relative flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Withdrawing from</span>
                  <span className="font-semibold text-foreground">{vault.name}</span>
                </div>
                <div className="relative mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Available</span>
                  <span>{fmtSats(vault.currentSats)} sats</span>
                </div>
              </div>
            )}

            {/* Method selector */}
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Withdrawal method</div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <MethodCard active={method === "lightning"} onClick={() => setMethod("lightning")} icon={Zap} label="Lightning" sub="Instant" />
              <MethodCard active={method === "momo"} onClick={() => setMethod("momo")} icon={Smartphone} label="Mobile Money" sub="2-5 min" />
            </div>

            <AnimatePresence mode="wait">
              {method === "lightning" ? (
                <motion.div key="ln-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Lightning invoice or address</div>
                    <div className="rounded-2xl glass p-4 flex items-start gap-3">
                      <Zap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="lnbc... or user@wallet.com"
                        rows={3}
                        className="flex-1 bg-transparent text-sm focus:outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed"
                      />
                      {address ? (
                        <button onClick={() => setAddress("")} className="text-muted-foreground hover:text-foreground shrink-0">
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={async () => { try { const t = await navigator.clipboard.readText(); setAddress(t); } catch {} }}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                        </button>
                      )}
                    </div>
                  </div>
                  <AmountField amount={amount} setAmount={setAmount} maxAmount={maxAmount} />
                  {isEarly && <EarlyWarningBadge pct={pct} />}
                  <button
                    disabled={!canContinue()}
                    onClick={() => isEarly ? setStep("warning") : setStep("done")}
                    className="w-full grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral active:scale-[0.98] transition disabled:opacity-40"
                  >
                    Continue
                  </button>
                </motion.div>
              ) : (
                <motion.div key="momo-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Provider</div>
                    <div className="grid grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => (
                        <button key={p} onClick={() => setProvider(p)} className={`py-3 rounded-xl text-xs font-medium transition ${provider === p ? "grad-coral text-background" : "glass text-muted-foreground"}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Receiving phone number</div>
                    <div className="rounded-2xl glass p-4 flex items-center gap-3">
                      <div className="text-sm text-muted-foreground shrink-0">+260</div>
                      <div className="w-px h-5 bg-white/10 shrink-0" />
                      <input
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="97 123 4567"
                        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 tracking-wide"
                      />
                      {phone && <button onClick={() => setPhone("")} className="text-muted-foreground"><XIcon className="w-3.5 h-3.5" /></button>}
                    </div>
                    <div className="mt-1.5 text-[10px] text-muted-foreground pl-1">Make sure the number matches the {provider} account.</div>
                  </div>
                  <AmountField amount={amount} setAmount={setAmount} maxAmount={maxAmount} />
                  {isEarly && <EarlyWarningBadge pct={pct} />}
                  <button
                    disabled={!canContinue()}
                    onClick={() => isEarly ? setStep("warning") : setStep("done")}
                    className="w-full grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral active:scale-[0.98] transition disabled:opacity-40"
                  >
                    Continue
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Step 4: Early withdrawal warning */}
        {step === "warning" && vault && (
          <motion.div key="warning" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-[oklch(0.74_0.18_25)]/30 bg-[oklch(0.74_0.18_25)]/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-[oklch(0.74_0.18_25)]" />
                <div className="text-sm font-semibold">Early Withdrawal Warning</div>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex justify-between"><span>Withdrawal amount</span><span className="text-foreground font-semibold">{fmtSats(Number(amount))}</span></div>
                <div className="flex justify-between text-[oklch(0.85_0.15_25)]"><span>Early exit penalty (2.5%)</span><span className="font-semibold">-{fmtSats(penalty)}</span></div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between"><span>You will receive</span><span className="text-foreground font-semibold">{fmtSats(receiveAmount)}</span></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                You're <span className="text-foreground font-semibold">{Math.round(pct * 100)}%</span> of the way to your goal in <span className="text-foreground font-semibold">{vault.name}</span>. Future you might thank you for holding on.
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStep("amount")} className="flex-1 glass py-4 rounded-2xl font-semibold text-sm">Keep stacking</button>
              <button onClick={() => setStep("done")} className="flex-1 bg-[oklch(0.74_0.18_25)]/20 text-[oklch(0.85_0.15_25)] border border-[oklch(0.74_0.18_25)]/30 py-4 rounded-2xl font-semibold text-sm">Withdraw anyway</button>
            </div>
          </motion.div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center gap-4 py-4">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-full grad-teal flex items-center justify-center"
            >
              <CheckCircle2 className="w-10 h-10 text-background" />
            </motion.div>
            <div className="text-lg font-semibold">Withdrawal Initiated</div>
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">{fmtSats(receiveAmount)}</span> is on its way via {method === "lightning" ? "Lightning" : "Mobile Money"}.
            </div>
            <div className="w-full rounded-2xl glass p-4 text-left flex flex-col gap-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Source</span><span className="text-foreground font-medium">{source === "balance" ? "Main Balance" : vault?.name}</span></div>
              <div className="flex justify-between"><span>Method</span><span className="text-foreground font-medium">{method === "lightning" ? "Lightning" : `${provider} (Mobile Money)`}</span></div>
              {method === "lightning" && (
                <div className="flex justify-between gap-4"><span className="shrink-0">To</span><span className="text-foreground font-medium truncate">{address}</span></div>
              )}
              {method === "momo" && (
                <div className="flex justify-between"><span>To</span><span className="text-foreground font-medium">+260 {phone}</span></div>
              )}
              <div className="h-px bg-white/10" />
              <div className="flex justify-between"><span>Amount</span><span className="text-foreground font-medium">{fmtSats(receiveAmount)}</span></div>
            </div>
            <button onClick={reset} className="mt-2 w-full grad-teal text-primary-foreground font-semibold py-4 rounded-2xl">Done</button>
          </motion.div>
        )}

      </AnimatePresence>
    </Sheet>
  );
}

function AmountField({ amount, setAmount, maxAmount }: { amount: string; setAmount: (v: string) => void; maxAmount: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amount</div>
      <div className="rounded-2xl glass p-5 flex items-center justify-center gap-2">
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          className="bg-transparent text-3xl font-semibold text-center tabular-nums focus:outline-none w-44"
          placeholder="0"
        />
        <span className="text-sm text-muted-foreground">sats</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Available: <span className="text-foreground font-semibold">{fmtSats(maxAmount)}</span></span>
        <button onClick={() => setAmount(String(maxAmount))} className="text-[oklch(0.82_0.13_190)] font-semibold text-[10px] uppercase tracking-wider">Max</button>
      </div>
    </div>
  );
}

function EarlyWarningBadge({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[oklch(0.74_0.18_25)]/10 border border-[oklch(0.74_0.18_25)]/20 px-3 py-2">
      <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.74_0.18_25)] shrink-0" />
      <span className="text-xs text-muted-foreground">Vault at <span className="text-foreground font-semibold">{Math.round(pct * 100)}%</span>. Early withdrawal applies a 2.5% penalty.</span>
    </div>
  );
}

function MethodCard({ active, onClick, icon: Icon, label, sub }: { active: boolean; onClick: () => void; icon: typeof Zap; label: string; sub: string }) {
  return (
    <button onClick={onClick} className={`rounded-2xl p-4 flex flex-col items-start gap-2 text-left transition border ${active ? "bg-card border-primary/50 shadow-glow-coral" : "bg-card/50 border-transparent"}`}>
      <div className={`w-10 h-10 rounded-xl ${active ? "grad-coral" : "bg-white/5"} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${active ? "text-background" : ""}`} />
      </div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </button>
  );
}
