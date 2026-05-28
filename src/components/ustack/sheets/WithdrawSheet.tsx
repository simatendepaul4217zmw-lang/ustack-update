import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Smartphone, AlertTriangle, Lock, TrendingUp, ChevronRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { vaults, fmtSats, type Vault } from "@/lib/ustack-data";

type Step = "vault" | "locked" | "amount" | "warning" | "done";

const accentGrad: Record<string, string> = {
  coral: "grad-coral", teal: "grad-teal", mint: "grad-mint", aqua: "grad-teal", btc: "grad-btc",
};

export function WithdrawSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("vault");
  const [vault, setVault] = useState<Vault | null>(null);
  const [method, setMethod] = useState<"lightning" | "momo">("lightning");
  const [amount, setAmount] = useState("");

  const reset = () => { setStep("vault"); setVault(null); setAmount(""); onClose(); };

  const selectVault = (v: Vault) => {
    setVault(v);
    if (v.type === "hodl" && v.locked) {
      setStep("locked");
    } else {
      setAmount(String(Math.floor(v.currentSats * 0.1)));
      setStep("amount");
    }
  };

  const pct = vault ? vault.currentSats / vault.goalSats : 0;
  const isEarly = pct < 1;
  const penalty = Math.floor((Number(amount) || 0) * 0.025);

  return (
    <Sheet open={open} onClose={reset} title={
      step === "vault" ? "Withdraw from Vault" :
      step === "locked" ? `${vault?.emoji} ${vault?.name}` :
      step === "amount" ? `${vault?.emoji} ${vault?.name}` :
      step === "warning" ? "Early Withdrawal" :
      "Withdrawal Sent"
    }>
      <AnimatePresence mode="wait">

        {/* ── Step 1: Vault picker ── */}
        {step === "vault" && (
          <motion.div key="vault" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm text-muted-foreground mb-4">Choose which vault to withdraw from.</p>
            <div className="flex flex-col gap-2">
              {vaults.map((v) => {
                const p = v.currentSats / v.goalSats;
                return (
                  <button
                    key={v.id}
                    onClick={() => selectVault(v)}
                    className="flex items-center gap-3 rounded-2xl glass p-4 text-left transition active:scale-[0.98]"
                  >
                    <div className={`w-11 h-11 rounded-xl ${accentGrad[v.accent]} flex items-center justify-center text-xl shrink-0`}>
                      {v.emoji}
                    </div>
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

        {/* ── Step 2a: Locked vault — blocked ── */}
        {step === "locked" && vault && (
          <motion.div key="locked" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col items-center text-center gap-3 mt-2">
              <div className="w-16 h-16 rounded-2xl grad-coral flex items-center justify-center">
                <Lock className="w-8 h-8 text-background" />
              </div>
              <div className="text-base font-semibold">This vault is locked</div>
              <div className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{vault.name}</span> is a Hodl Vault — funds are locked until the target period ends.
              </div>
              <div className="w-full rounded-xl bg-white/5 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Days remaining</span>
                <span className="text-sm font-semibold">{vault.daysRemaining} days</span>
              </div>
              <div className="w-full rounded-xl bg-white/5 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-sm font-semibold">{Math.round(pct * 100)}% of goal</span>
              </div>
              <p className="text-xs text-muted-foreground">Stay disciplined — future you will be grateful. 🙏</p>
            </div>
            <button
              onClick={() => setStep("vault")}
              className="mt-5 w-full flex items-center justify-center gap-2 grad-teal text-primary-foreground font-semibold py-4 rounded-2xl"
            >
              Keep Stacking
            </button>
            <button onClick={() => setStep("vault")} className="mt-3 w-full text-muted-foreground text-sm py-2 flex items-center justify-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to vaults
            </button>
          </motion.div>
        )}

        {/* ── Step 2b: Amount & method ── */}
        {step === "amount" && vault && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep("vault")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to vaults
            </button>

            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Withdrawal method</div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <MethodCard active={method === "lightning"} onClick={() => setMethod("lightning")} icon={Zap} label="Lightning" sub="Instant" />
              <MethodCard active={method === "momo"} onClick={() => setMethod("momo")} icon={Smartphone} label="Mobile Money" sub="2–5 min" />
            </div>

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
            <div className="mt-2 text-center text-xs text-muted-foreground">
              Available in vault: <span className="text-foreground font-semibold">{fmtSats(vault.currentSats)}</span>
            </div>

            {isEarly && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[oklch(0.74_0.18_25)]/10 border border-[oklch(0.74_0.18_25)]/20 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.74_0.18_25)] shrink-0" />
                <span className="text-xs text-muted-foreground">Vault is at <span className="text-foreground font-semibold">{Math.round(pct * 100)}%</span> — early withdrawal applies a 2.5% penalty.</span>
              </div>
            )}

            <button
              disabled={!amount || Number(amount) <= 0}
              onClick={() => isEarly ? setStep("warning") : setStep("done")}
              className="mt-6 w-full grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral active:scale-[0.98] transition disabled:opacity-40"
            >
              Continue
            </button>
          </motion.div>
        )}

        {/* ── Step 3: Early withdrawal warning ── */}
        {step === "warning" && vault && (
          <motion.div key="warning" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-[oklch(0.74_0.18_25)]/30 bg-[oklch(0.74_0.18_25)]/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-[oklch(0.74_0.18_25)]" />
                <div className="text-sm font-semibold">Early Withdrawal Warning</div>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground leading-relaxed">
                <div className="flex justify-between">
                  <span>Withdrawal amount</span>
                  <span className="text-foreground font-semibold">{fmtSats(Number(amount))}</span>
                </div>
                <div className="flex justify-between text-[oklch(0.85_0.15_25)]">
                  <span>Early exit penalty (2.5%)</span>
                  <span className="font-semibold">−{fmtSats(penalty)}</span>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between">
                  <span>You'll receive</span>
                  <span className="text-foreground font-semibold">{fmtSats(Number(amount) - penalty)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                You're <span className="text-foreground font-semibold">{Math.round(pct * 100)}%</span> of the way to your goal in <span className="text-foreground font-semibold">{vault.name}</span>. Future you might thank you for holding on. 💪
              </p>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={() => setStep("amount")} className="flex-1 glass py-4 rounded-2xl font-semibold text-sm">
                Keep stacking
              </button>
              <button
                onClick={() => setStep("done")}
                className="flex-1 bg-[oklch(0.74_0.18_25)]/20 text-[oklch(0.85_0.15_25)] border border-[oklch(0.74_0.18_25)]/30 py-4 rounded-2xl font-semibold text-sm"
              >
                Withdraw anyway
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && vault && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center gap-4 py-4">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-full grad-teal flex items-center justify-center"
            >
              <CheckCircle2 className="w-10 h-10 text-background" />
            </motion.div>
            <div className="text-lg font-semibold">Withdrawal Initiated</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">{fmtSats(Number(amount) - (isEarly ? penalty : 0))}</span> will arrive via {method === "lightning" ? "Lightning" : "Mobile Money"} shortly.
            </div>
            <div className="w-full rounded-2xl glass p-4 text-left flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Vault</span><span className="text-foreground font-medium">{vault.emoji} {vault.name}</span></div>
              <div className="flex justify-between"><span>Method</span><span className="text-foreground font-medium">{method === "lightning" ? "⚡ Lightning" : "📱 Mobile Money"}</span></div>
              <div className="flex justify-between"><span>Amount</span><span className="text-foreground font-medium">{fmtSats(Number(amount) - (isEarly ? penalty : 0))}</span></div>
            </div>
            <button onClick={reset} className="mt-2 w-full grad-teal text-primary-foreground font-semibold py-4 rounded-2xl">
              Done
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </Sheet>
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
