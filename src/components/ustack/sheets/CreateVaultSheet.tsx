import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, TrendingUp, ChevronRight, ChevronLeft, ShieldCheck, Sparkles, Clock, Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { useCreateVault } from "@/lib/hooks/useAppData";
import type { Vault } from "@/lib/ustack-data";
import { ACCENT_COLORS, VAULT_ACCENTS, VAULT_ICONS, VaultIcon } from "@/lib/vault-theme";

const PRESET_LOCK_OPTIONS = [
  { months: 3,  label: "3 months",  days: 90  },
  { months: 6,  label: "6 months",  days: 180 },
  { months: 12, label: "1 year",    days: 365 },
  { months: 24, label: "2 years",   days: 730 },
];

export function CreateVaultSheet({ open, onClose, onDeposit }: { open: boolean; onClose: () => void; onDeposit: (vault: Vault) => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"hodl" | "stack">("stack");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Target");
  const [accent, setAccent] = useState<"btc" | "purple" | "teal" | "blue" | "rose" | "gold">("btc");
  const [goal, setGoal] = useState(1_000_000);
  const [lockMonths, setLockMonths] = useState(6);
  const [customMonths, setCustomMonths] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState("");

  const { mutateAsync: createVault, isPending } = useCreateVault();

  const total = 5;
  const effectiveLockMonths = useCustom ? (parseInt(customMonths) || 1) : lockMonths;

  const close = () => {
    setStep(0); setName(""); setGoal(1_000_000); setLockMonths(6);
    setIcon("Target"); setAccent("btc"); setError(""); setUseCustom(false); setCustomMonths("");
    onClose();
  };

  const next = () => {
    if (step === 1 && !name.trim()) { setError("Please name your vault"); return; }
    setError("");
    setStep(Math.min(step + 1, total - 1));
  };
  const prev = () => { setError(""); setStep(Math.max(step - 1, 0)); };

  const handleCreate = async () => {
    try {
      const newVault = await createVault({
        name: name.trim() || "My Vault",
        vaultType: type,
        emoji: icon,
        accent,
        goalSats: goal,
        currency: "ZMW",
        lockMonths: type === "hodl" ? effectiveLockMonths : 0,
      });
      close();
      setTimeout(() => onDeposit(newVault), 400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create vault");
    }
  };

  return (
    <Sheet open={open} onClose={close} title="Create Vault">
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div animate={{ width: i <= step ? "100%" : "0%" }} className="h-full bg-primary" />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {/* Step 0 — Vault type */}
          {step === 0 && (
            <div>
              <div className="text-xl font-semibold">Choose vault type</div>
              <div className="text-sm text-muted-foreground mt-1 mb-5">Pick how you want to save.</div>
              <div className="flex flex-col gap-3">
                <TypeCard active={type === "hodl"} onClick={() => setType("hodl")} icon={Lock} iconColor={ACCENT_COLORS.rose} title="Hodl Vault" sub="Lock sats for a set time period, e.g. 6 months. Funds are frozen until the lock expires." />
                <TypeCard active={type === "stack"} onClick={() => setType("stack")} icon={TrendingUp} iconColor={ACCENT_COLORS.teal} title="Stack Vault" sub="Stack until you hit a target amount, e.g. 1,000,000 sats. Transfer anytime with a 45% early penalty." />
              </div>
            </div>
          )}

          {/* Step 1 — Name + icon + accent */}
          {step === 1 && (
            <div>
              <div className="text-xl font-semibold">Name your vault</div>
              <div className="text-sm text-muted-foreground mt-1">Make it personal. Specific names stick.</div>
              <input
                autoFocus
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. School Fees"
                className="mt-5 w-full bg-card border border-border rounded-2xl px-4 py-4 text-base focus:border-primary focus:outline-none transition"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {["School Fees", "Future Business", "Emergency", "New Laptop"].map((s) => (
                  <button key={s} onClick={() => setName(s)} className="px-3 py-1.5 rounded-full glass text-xs">{s}</button>
                ))}
              </div>

              <div className="mt-5">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Icon</div>
                <div className="flex gap-2 flex-wrap">
                  {VAULT_ICONS.map((name) => (
                    <button
                      key={name}
                      onClick={() => setIcon(name)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${icon === name ? "ring-1 ring-primary" : "glass"}`}
                      style={icon === name ? { background: `${ACCENT_COLORS[accent]}20`, color: ACCENT_COLORS[accent] } : { color: "oklch(0.6 0 0)" }}
                    >
                      <VaultIcon name={name} className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Color</div>
                <div className="flex gap-2">
                  {VAULT_ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAccent(a.value)}
                      className={`w-8 h-8 rounded-full transition ${accent === a.value ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""}`}
                      style={{ background: ACCENT_COLORS[a.value] }}
                      title={a.label}
                    />
                  ))}
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* Step 2 — Target amount */}
          {step === 2 && (
            <div>
              <div className="text-xl font-semibold">{type === "hodl" ? "Set your target amount" : "Set your goal"}</div>
              <div className="text-sm text-muted-foreground mt-1">{type === "hodl" ? "How many sats do you want locked away?" : "How many sats do you want to stack?"}</div>
              <div className="mt-5 rounded-2xl glass p-5 text-center">
                <div className="text-xs text-muted-foreground">Target</div>
                <div className="text-3xl font-semibold mt-1 tabular-nums">{goal.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">sats</div>
              </div>
              <input type="range" min={50_000} max={5_000_000} step={50_000} value={goal} onChange={(e) => setGoal(parseInt(e.target.value))} className="mt-5 w-full" style={{ accentColor: ACCENT_COLORS[accent] }} />
              <div className="mt-3 flex gap-2">
                {[100_000, 500_000, 1_000_000, 2_500_000].map((v) => (
                  <button key={v} onClick={() => setGoal(v)} className="flex-1 py-2 rounded-xl glass text-xs">{(v / 1000)}k</button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Lock duration (Hodl) or info (Stack) */}
          {step === 3 && type === "hodl" && (
            <div>
              <div className="text-xl font-semibold">Set lock duration</div>
              <div className="text-sm text-muted-foreground mt-1 mb-5">Your sats will be frozen for this period.</div>
              <div className="flex flex-col gap-2">
                {PRESET_LOCK_OPTIONS.map((opt) => {
                  const selected = !useCustom && lockMonths === opt.months;
                  return (
                    <button key={opt.months} onClick={() => { setLockMonths(opt.months); setUseCustom(false); }} className={`flex items-center gap-4 rounded-2xl p-4 text-left border transition ${selected ? "bg-card border-primary/50" : "bg-card/50 border-transparent glass"}`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={selected ? { background: ACCENT_COLORS[accent], color: "white" } : { background: "oklch(1 0 0 / 0.05)" }}>
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.days} days locked</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-muted"}`} />
                    </button>
                  );
                })}

                {/* Custom option */}
                <button onClick={() => setUseCustom(true)} className={`flex items-center gap-4 rounded-2xl p-4 text-left border transition ${useCustom ? "bg-card border-primary/50" : "bg-card/50 border-transparent glass"}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={useCustom ? { background: ACCENT_COLORS[accent], color: "white" } : { background: "oklch(1 0 0 / 0.05)" }}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    {useCustom ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="number"
                          min={1}
                          value={customMonths}
                          onChange={(e) => setCustomMonths(e.target.value.replace(/\D/g, ""))}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="e.g. 18"
                          className="w-20 bg-transparent border-b border-primary text-sm font-semibold focus:outline-none tabular-nums"
                        />
                        <span className="text-sm text-muted-foreground">months</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-semibold">Custom</div>
                        <div className="text-xs text-muted-foreground">Enter any number of months</div>
                      </>
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 ${useCustom ? "border-primary bg-primary" : "border-muted"}`} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && type === "stack" && (
            <div>
              <div className="text-xl font-semibold">How it works</div>
              <div className="text-sm text-muted-foreground mt-1 mb-5">Stack vault rules: simple and flexible.</div>
              <div className="flex flex-col gap-3">
                <RuleRow title="Stack to your target" body={`Keep depositing until you hit ${goal.toLocaleString()} sats.`} />
                <RuleRow title="Early withdrawal" body="You can withdraw anytime, but a 45% penalty applies if you haven't reached your goal." />
                <RuleRow title="Streak rewards" body="Stack consistently to build your streak and stay disciplined." />
              </div>
            </div>
          )}

          {/* Step 4 — Confirm */}
          {step === 4 && (
            <div>
              <div className="text-xl font-semibold">Confirm vault</div>
              <div className="text-sm text-muted-foreground mt-1">Review and create.</div>
              <div className="mt-5 rounded-2xl glass p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT_COLORS[accent]}20`, color: ACCENT_COLORS[accent] }}>
                    <VaultIcon name={icon} className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold">{name || "Untitled"}</div>
                    <div className="text-xs text-muted-foreground">{type === "hodl" ? "Hodl Vault" : "Stack Vault"}</div>
                  </div>
                </div>
                <Summary k="Target" v={`${goal.toLocaleString()} sats`} />
                {type === "hodl"
                  ? <Summary k="Lock duration" v={useCustom ? `${effectiveLockMonths} months` : PRESET_LOCK_OPTIONS.find(o => o.months === lockMonths)?.label ?? `${lockMonths}mo`} />
                  : <Summary k="Transfers" v="Flexible (45% early penalty)" />
                }
              </div>
              <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[oklch(0.78_0.14_190)] mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {type === "hodl"
                    ? `Your sats will be fully locked for ${useCustom ? `${effectiveLockMonths} months` : PRESET_LOCK_OPTIONS.find(o => o.months === lockMonths)?.label}. This is intentional. It keeps your future self protected.`
                    : "You can withdraw at any time. The 45% penalty is there to keep you disciplined, not to punish you."}
                </p>
              </div>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <button onClick={prev} className="w-14 h-14 rounded-2xl glass flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {step < total - 1 ? (
          <button onClick={next} className="flex-1 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition flex items-center justify-center gap-2">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="flex-1 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Create Vault</>}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function TypeCard({ active, onClick, icon: Icon, title, sub, iconColor }: { active: boolean; onClick: () => void; icon: typeof Lock; title: string; sub: string; iconColor: string }) {
  return (
    <button onClick={onClick} className={`rounded-2xl p-4 flex items-start gap-4 text-left transition border ${active ? "bg-card border-primary/50" : "bg-card/50 border-transparent"}`}>
      <div className="w-12 h-12 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color: iconColor }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{sub}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${active ? "border-primary bg-primary" : "border-muted"}`} />
    </button>
  );
}

function RuleRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</div>
    </div>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
