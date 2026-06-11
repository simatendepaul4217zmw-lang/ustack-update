import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, TrendingUp, ChevronRight, ChevronLeft, ShieldCheck, Sparkles, Clock, Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { useCreateVault } from "@/lib/hooks/useAppData";

const LOCK_OPTIONS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
  { months: 24, label: "2 years" },
];

const EMOJIS = ["💰", "🎓", "💻", "🛡️", "🚀", "✈️", "🏠", "💍", "🏥", "🌍"];
const ACCENTS = [
  { value: "btc" as const, label: "Bitcoin", color: "oklch(0.74 0.18 55)" },
  { value: "teal" as const, label: "Teal", color: "oklch(0.78 0.14 190)" },
  { value: "mint" as const, label: "Mint", color: "oklch(0.86 0.13 160)" },
  { value: "coral" as const, label: "Coral", color: "oklch(0.73 0.19 55)" },
  { value: "aqua" as const, label: "Aqua", color: "oklch(0.78 0.14 190)" },
];

export function CreateVaultSheet({ open, onClose, onDeposit }: { open: boolean; onClose: () => void; onDeposit: () => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"hodl" | "stack">("stack");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💰");
  const [accent, setAccent] = useState<"btc" | "teal" | "mint" | "coral" | "aqua">("btc");
  const [goal, setGoal] = useState(1_000_000);
  const [lockMonths, setLockMonths] = useState(6);
  const [error, setError] = useState("");

  const { mutateAsync: createVault, isPending } = useCreateVault();

  const total = 5;

  const close = () => {
    setStep(0); setName(""); setGoal(1_000_000); setLockMonths(6);
    setEmoji("💰"); setAccent("btc"); setError("");
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
      await createVault({
        name: name.trim() || "My Vault",
        vaultType: type,
        emoji,
        accent,
        goalSats: goal,
        currency: "ZMW",
        lockMonths: type === "hodl" ? lockMonths : 0,
      });
      close();
      setTimeout(onDeposit, 400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create vault");
    }
  };

  return (
    <Sheet open={open} onClose={close} title="Create Vault">
      {/* progress */}
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
                <TypeCard active={type === "hodl"} onClick={() => setType("hodl")} icon={Lock} iconColor="oklch(0.73 0.19 55)" title="Hodl Vault" sub="Lock sats for a set time period, e.g. 6 months. Funds are frozen until the lock expires." />
                <TypeCard active={type === "stack"} onClick={() => setType("stack")} icon={TrendingUp} iconColor="oklch(0.78 0.14 190)" title="Stack Vault" sub="Stack until you hit a target amount, e.g. 1,000,000 sats. Transfer anytime with a small penalty." />
              </div>
            </div>
          )}

          {/* Step 1 — Name + emoji + accent */}
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
              {/* Emoji picker */}
              <div className="mt-5">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Icon</div>
                <div className="flex gap-2 flex-wrap">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => setEmoji(e)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${emoji === e ? "bg-primary/20 ring-1 ring-primary" : "glass"}`}>{e}</button>
                  ))}
                </div>
              </div>
              {/* Accent picker */}
              <div className="mt-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Color</div>
                <div className="flex gap-2">
                  {ACCENTS.map((a) => (
                    <button key={a.value} onClick={() => setAccent(a.value)} className={`w-8 h-8 rounded-full transition ${accent === a.value ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""}`} style={{ background: a.color }} />
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
              <input type="range" min={50_000} max={5_000_000} step={50_000} value={goal} onChange={(e) => setGoal(parseInt(e.target.value))} className="mt-5 w-full accent-[oklch(0.73_0.19_55)]" />
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
                {LOCK_OPTIONS.map((opt) => (
                  <button key={opt.months} onClick={() => setLockMonths(opt.months)} className={`flex items-center gap-4 rounded-2xl p-4 text-left border transition ${lockMonths === opt.months ? "bg-card border-primary/50" : "bg-card/50 border-transparent glass"}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={lockMonths === opt.months ? { background: "oklch(0.73 0.19 55)", color: "white" } : { background: "oklch(1 0 0 / 0.05)" }}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.months * 30} days locked</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${lockMonths === opt.months ? "border-primary bg-primary" : "border-muted"}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && type === "stack" && (
            <div>
              <div className="text-xl font-semibold">How it works</div>
              <div className="text-sm text-muted-foreground mt-1 mb-5">Stack vault rules: simple and flexible.</div>
              <div className="flex flex-col gap-3">
                <RuleRow title="Stack to your target" body={`Keep depositing until you hit ${goal.toLocaleString()} sats.`} />
                <RuleRow title="Early withdrawal" body="You can withdraw anytime, but a 10% penalty applies if you haven't reached your goal." />
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
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl">{emoji}</div>
                  <div>
                    <div className="font-semibold">{name || "Untitled"}</div>
                    <div className="text-xs text-muted-foreground">{type === "hodl" ? "Hodl Vault" : "Stack Vault"}</div>
                  </div>
                </div>
                <Summary k="Target" v={`${goal.toLocaleString()} sats`} />
                {type === "hodl"
                  ? <Summary k="Lock duration" v={LOCK_OPTIONS.find(o => o.months === lockMonths)?.label ?? `${lockMonths}mo`} />
                  : <Summary k="Transfers" v="Flexible (10% early penalty)" />
                }
              </div>
              <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[oklch(0.78_0.14_190)] mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {type === "hodl" ? `Your sats will be fully locked for ${LOCK_OPTIONS.find(o => o.months === lockMonths)?.label}. This is intentional. It keeps your future self protected.` : "You can withdraw at any time. The 10% penalty is there to keep you disciplined, not to punish you."}
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
