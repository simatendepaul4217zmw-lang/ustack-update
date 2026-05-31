import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Smartphone, CheckCircle2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { availableSats, fmtSats } from "@/lib/ustack-data";

type Step = "form" | "done";
type MoMoProvider = "airtel" | "mtn" | "zamtel";

const MOMO_PROVIDERS: { id: MoMoProvider; label: string; sub: string }[] = [
  { id: "airtel", label: "Airtel Money", sub: "097 · 099" },
  { id: "mtn",    label: "MTN MoMo",    sub: "076 · 078" },
  { id: "zamtel", label: "Zamtel Kwacha", sub: "095 · 096" },
];

export function SendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("form");
  const [method, setMethod] = useState<"lightning" | "momo">("lightning");
  const [provider, setProvider] = useState<MoMoProvider>("airtel");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");

  const reset = () => { setStep("form"); setAddress(""); setPhone(""); setAmount(""); onClose(); };
  const recipient = method === "lightning" ? address : phone;
  const canContinue = recipient.trim().length > 0 && Number(amount) > 0 && Number(amount) <= availableSats;

  return (
    <Sheet open={open} onClose={reset} title="Send Sats">
      <AnimatePresence mode="wait">

        {step === "form" && (
          <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Send via</div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <MethodCard
                active={method === "lightning"} onClick={() => setMethod("lightning")}
                icon={Zap} label="Lightning" sub="Instant"
              />
              <MethodCard
                active={method === "momo"} onClick={() => setMethod("momo")}
                icon={Smartphone} label="Mobile Money" sub="2-5 min"
              />
            </div>

            <AnimatePresence mode="wait">
              {method === "momo" && (
                <motion.div
                  key="provider"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mb-5">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Provider</div>
                    <div className="flex flex-col gap-2">
                      {MOMO_PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setProvider(p.id)}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left border transition ${provider === p.id ? "bg-card border-primary/50" : "bg-card/50 border-transparent glass"}`}
                        >
                          <div className={`w-2 h-2 rounded-full shrink-0 ${provider === p.id ? "bg-primary" : "bg-white/20"}`} />
                          <span className="flex-1 text-sm font-medium">{p.label}</span>
                          <span className="text-[10px] text-muted-foreground">{p.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {method === "lightning" ? "Lightning address or invoice" : "Phone number"}
            </div>
            {method === "lightning" ? (
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="you@wallet.btc or lnbc..."
                className="w-full rounded-2xl glass px-4 py-3.5 text-sm focus:outline-none placeholder:text-muted-foreground/50 mb-5"
              />
            ) : (
              <div className="flex gap-2 mb-5">
                <div className="rounded-2xl glass px-4 py-3.5 text-sm text-muted-foreground shrink-0 select-none">+260</div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="97X XXX XXX"
                  className="flex-1 rounded-2xl glass px-4 py-3.5 text-sm focus:outline-none placeholder:text-muted-foreground/50"
                />
              </div>
            )}

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
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                Available: <span className="text-foreground font-semibold">{fmtSats(availableSats)}</span>
              </span>
              <button
                onClick={() => setAmount(String(availableSats))}
                className="text-xs font-semibold text-primary px-2.5 py-1 rounded-lg glass"
              >
                Max
              </button>
            </div>

            <button
              disabled={!canContinue}
              onClick={() => setStep("done")}
              className="mt-6 w-full grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral active:scale-[0.98] transition disabled:opacity-40"
            >
              Send
            </button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center gap-4 py-4">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-full grad-teal flex items-center justify-center"
            >
              <CheckCircle2 className="w-10 h-10 text-background" />
            </motion.div>
            <div className="text-lg font-semibold">Payment Sent</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">{fmtSats(Number(amount))}</span> sent via {method === "lightning" ? "Lightning" : "Mobile Money"}.
            </div>
            <div className="w-full rounded-2xl glass p-4 text-left flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>To</span>
                <span className="text-foreground font-medium truncate max-w-[180px]">
                  {method === "lightning" ? address : `+260 ${phone}`}
                </span>
              </div>
              {method === "momo" && (
                <div className="flex justify-between">
                  <span>Provider</span>
                  <span className="text-foreground font-medium">
                    {MOMO_PROVIDERS.find(p => p.id === provider)?.label}
                  </span>
                </div>
              )}
              <div className="flex justify-between"><span>Method</span><span className="text-foreground font-medium">{method === "lightning" ? "Lightning" : "Mobile Money"}</span></div>
              <div className="flex justify-between"><span>Amount</span><span className="text-foreground font-medium">{fmtSats(Number(amount))}</span></div>
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
