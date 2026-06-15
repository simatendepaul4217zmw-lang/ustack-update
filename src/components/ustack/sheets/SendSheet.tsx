import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import { Sheet } from "./Sheet";
import { fmtSats } from "@/lib/ustack-data";
import { useCurrency } from "@/lib/currency-context";
import { useWallet, useSendPayment, useMobileMoneyPayout, useBtcPrice } from "@/lib/hooks/useAppData";

type Step = "form" | "loading" | "done" | "error";
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
  const [errMsg, setErrMsg] = useState("");

  const { data: wallet } = useWallet();
  const { data: btcPrice } = useBtcPrice();
  const { fmtValue } = useCurrency();
  const sendPaymentMut = useSendPayment();
  const momoPayoutMut = useMobileMoneyPayout();

  const availableSats = wallet?.availableSats ?? 0;
  const priceZmw = btcPrice?.priceZmw;

  const reset = () => {
    setStep("form");
    setAddress(""); setPhone(""); setAmount(""); setErrMsg("");
    onClose();
  };

  const recipient = method === "lightning" ? address : phone;
  const amtNum = Number(amount);
  const canContinue = recipient.trim().length > 0 && amtNum > 0 && amtNum <= availableSats;

  const handleSend = async () => {
    setErrMsg("");
    setStep("loading");
    try {
      if (method === "lightning") {
        await sendPaymentMut.mutateAsync({ paymentRequest: address.trim(), amountSats: amtNum });
      } else {
        await momoPayoutMut.mutateAsync({ phone: phone.trim(), amountSats: amtNum, provider });
      }
      setStep("done");
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Payment failed. Please try again.");
      setStep("error");
    }
  };

  return (
    <Sheet open={open} onClose={reset} title="Send Sats">
      <AnimatePresence mode="wait">

        {(step === "form" || step === "error") && (
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
              {method === "momo" ? (
                <motion.div key="momo-soon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">Mobile Money — Coming Soon</div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                      We're finalising our Lipila integration. Sending via Airtel Money, MTN MoMo, and Zamtel Kwacha will be available very soon.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Use Lightning to send sats for now.</p>
                  <button onClick={() => setMethod("lightning")} className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">
                    Use Lightning instead
                  </button>
                </motion.div>
              ) : (
                <motion.div key="lightning-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-0">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Lightning address or invoice</div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="you@wallet.btc or lnbc..."
                    className="w-full rounded-2xl glass px-4 py-3.5 text-sm focus:outline-none placeholder:text-muted-foreground/50 mb-5"
                  />

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
                  {amtNum > 0 && (
                    <div className="mt-1 text-center text-xs font-medium text-foreground/70 tabular-nums">
                      {fmtValue(amtNum, priceZmw)}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between px-1">
                    <span className="text-xs text-muted-foreground">
                      Available: <span className="text-foreground font-semibold">{fmtSats(availableSats)}</span>
                    </span>
                    <button onClick={() => setAmount(String(availableSats))} className="text-xs font-semibold text-primary px-2.5 py-1 rounded-lg glass">
                      Max
                    </button>
                  </div>

                  {step === "error" && errMsg && (
                    <div className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errMsg}
                    </div>
                  )}

                  <button
                    disabled={!canContinue}
                    onClick={handleSend}
                    className="mt-6 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40"
                  >
                    Send
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {step === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-4 py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full border-2 border-white/20 border-t-primary"
            />
            <div className="text-sm text-muted-foreground">Sending {fmtSats(amtNum)} sats…</div>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center gap-4 py-4">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center"
              style={{ color: "oklch(0.78 0.14 190)" }}
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            <div className="text-lg font-semibold">Payment Sent</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">{fmtSats(amtNum)}</span> sent via {method === "lightning" ? "Lightning" : "Mobile Money"}.
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
              <div className="flex justify-between">
                <span>Method</span>
                <span className="text-foreground font-medium">{method === "lightning" ? "Lightning" : "Mobile Money"}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount</span>
                <span className="text-foreground font-medium">{fmtSats(amtNum)} sats</span>
              </div>
            </div>
            <button onClick={reset} className="mt-2 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">
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
    <button onClick={onClick} className={`rounded-2xl p-4 flex flex-col items-start gap-2 text-left transition border ${active ? "bg-card border-primary/50" : "bg-card/50 border-transparent"}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={active ? { background: "oklch(0.73 0.19 55)", color: "white" } : { background: "oklch(1 0 0 / 0.05)" }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </button>
  );
}
