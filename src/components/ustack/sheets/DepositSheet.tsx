import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Zap, Copy, Check, Wallet, LayoutGrid,
  ChevronRight, TrendingUp, Lock, ArrowLeft, X as XIcon, QrCode
} from "lucide-react";
import { Sheet } from "./Sheet";
import { vaults, fmtSats, type Vault } from "@/lib/ustack-data";

type Step = "dest" | "vault" | "method" | "processing" | "done";
type Dest = "balance" | "vault";

const accentGrad: Record<string, string> = {
  coral: "grad-coral", teal: "grad-teal", mint: "grad-mint", aqua: "grad-teal", btc: "grad-btc",
};

const PROVIDERS = ["Airtel", "MTN MoMo", "Zamtel"];
const QUICK_AMOUNTS = ["500", "1000", "2500", "5000"];

export function DepositSheet({
  open, onClose, vaultContext,
}: {
  open: boolean;
  onClose: () => void;
  vaultContext?: Vault | null;
}) {
  const [step, setStep] = useState<Step>("dest");
  const [dest, setDest] = useState<Dest>("balance");
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [tab, setTab] = useState<"momo" | "lightning">("momo");
  const [provider, setProvider] = useState("MTN MoMo");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("1000");
  const [lnAmount, setLnAmount] = useState("");
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && vaultContext) {
      setDest("vault");
      setSelectedVault(vaultContext);
      setStep("method");
    } else if (!open) {
      setStep("dest");
      setDest("balance");
      setSelectedVault(null);
      setTab("momo");
      setPhone("");
      setAmount("1000");
      setLnAmount("");
      setInvoiceReady(false);
    }
  }, [open, vaultContext]);

  const reset = () => {
    setStep("dest");
    setDest("balance");
    setSelectedVault(null);
    setTab("momo");
    setPhone("");
    setAmount("1000");
    setLnAmount("");
    setInvoiceReady(false);
    onClose();
  };

  const selectDest = (d: Dest) => {
    setDest(d);
    if (d === "balance") { setSelectedVault(null); setStep("method"); }
    else setStep("vault");
  };

  const selectVault = (v: Vault) => { setSelectedVault(v); setStep("method"); };

  const canConfirm = () => {
    if (tab === "lightning") return true;
    return phone.trim().length >= 9 && Number(amount) > 0;
  };

  const confirm = () => { setStep("processing"); setTimeout(() => setStep("done"), 1500); };

  const destLabel = dest === "balance" ? "Main Balance" : selectedVault?.name ?? "Vault";

  const titleMap: Record<Step, string> = {
    dest: "Add Funds",
    vault: "Select Vault",
    method: destLabel,
    processing: "Add Funds",
    done: "Add Funds",
  };

  const backFromMethod = () => {
    setInvoiceReady(false);
    setLnAmount("");
    if (vaultContext) { reset(); return; }
    dest === "balance" ? setStep("dest") : setStep("vault");
  };

  return (
    <Sheet open={open} onClose={reset} title={titleMap[step]}>
      <AnimatePresence mode="wait">

        {/* Step 1: Destination picker */}
        {step === "dest" && (
          <motion.div key="dest" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm text-muted-foreground mb-5">Where should the funds go?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => selectDest("balance")}
                className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10"
              >
                <div className="w-12 h-12 rounded-xl grad-teal flex items-center justify-center shrink-0">
                  <Wallet className="w-6 h-6 text-background" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Main Balance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Deposit directly to your available balance</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              <button
                onClick={() => selectDest("vault")}
                className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10"
              >
                <div className="w-12 h-12 rounded-xl grad-coral flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-6 h-6 text-background" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Into a Vault</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {vaults.length} vault{vaults.length !== 1 ? "s" : ""} to stack into
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Vault picker */}
        {step === "vault" && (
          <motion.div key="vault" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button onClick={() => setStep("dest")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <p className="text-sm text-muted-foreground mb-4">Choose which vault to deposit into.</p>
            <div className="flex flex-col gap-2">
              {vaults.map((v) => {
                const p = v.currentSats / v.goalSats;
                return (
                  <button
                    key={v.id}
                    onClick={() => selectVault(v)}
                    className="flex items-center gap-3 rounded-2xl glass p-4 text-left transition active:scale-[0.98]"
                  >
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

        {/* Step 3: Payment method */}
        {step === "method" && (
          <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {!vaultContext && (
              <button onClick={backFromMethod} className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}

            {/* Vault badge when coming from vault detail */}
            {dest === "vault" && selectedVault && (
              <div className={`rounded-2xl p-4 ${accentGrad[selectedVault.accent]} relative overflow-hidden mb-5`}>
                <div className="absolute inset-0 bg-background/60 backdrop-blur-xl" />
                <div className="relative flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Depositing into</span>
                  <span className="font-semibold text-foreground">{selectedVault.name}</span>
                </div>
                <div className="relative mt-1 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Progress</span>
                  <span>{Math.round((selectedVault.currentSats / selectedVault.goalSats) * 100)}% of goal</span>
                </div>
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex p-1 rounded-2xl bg-white/5 mb-5">
              {([["momo", "Mobile Money", Smartphone], ["lightning", "Lightning", Zap]] as const).map(([k, label, Icon]) => {
                const active = tab === k;
                return (
                  <button key={k} onClick={() => { setTab(k); setInvoiceReady(false); setLnAmount(""); }} className="relative flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
                    {active && <motion.div layoutId="dep-tab" className="absolute inset-0 grad-coral rounded-xl" />}
                    <Icon className={`relative w-4 h-4 ${active ? "text-background" : "text-muted-foreground"}`} />
                    <span className={`relative ${active ? "text-background" : "text-muted-foreground"}`}>{label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {tab === "momo" ? (
                <motion.div key="momo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Provider</div>
                    <div className="grid grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => (
                        <button key={p} onClick={() => setProvider(p)} className={`py-3 rounded-xl text-xs font-medium transition ${provider === p ? "grad-coral text-background" : "glass text-muted-foreground"}`}>{p}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Your mobile money number</div>
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
                    <div className="mt-1.5 text-[10px] text-muted-foreground pl-1">You will receive a prompt to approve the payment.</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amount (ZMW)</div>
                    <div className="rounded-2xl glass p-5 flex items-center justify-center gap-2">
                      <input
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="bg-transparent text-3xl font-semibold text-center tabular-nums focus:outline-none w-36"
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground">ZMW</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {QUICK_AMOUNTS.map((v) => (
                        <button key={v} onClick={() => setAmount(v)} className={`flex-1 py-2 rounded-xl text-xs transition ${amount === v ? "grad-coral text-background" : "glass text-muted-foreground"}`}>{v}</button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={!canConfirm()}
                    onClick={confirm}
                    className="w-full grad-btc text-background font-semibold py-4 rounded-2xl shadow-soft active:scale-[0.98] transition disabled:opacity-40"
                  >
                    Confirm deposit
                  </button>
                </motion.div>
              ) : (
                <motion.div key="ln" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                  <AnimatePresence mode="wait">
                    {!invoiceReady ? (
                      <motion.div key="ln-amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amount (sats)</div>
                          <div className="rounded-2xl glass p-5 flex items-center justify-center gap-2">
                            <input
                              inputMode="numeric"
                              value={lnAmount}
                              onChange={(e) => setLnAmount(e.target.value.replace(/\D/g, ""))}
                              className="bg-transparent text-3xl font-semibold text-center tabular-nums focus:outline-none w-44"
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground">sats</span>
                          </div>
                          <div className="mt-1.5 text-[10px] text-muted-foreground text-center">Enter the amount, then generate your invoice.</div>
                        </div>
                        <button
                          disabled={!lnAmount || Number(lnAmount) <= 0}
                          onClick={() => setInvoiceReady(true)}
                          className="w-full flex items-center justify-center gap-2 grad-btc text-background font-semibold py-4 rounded-2xl shadow-soft active:scale-[0.98] transition disabled:opacity-40"
                        >
                          <QrCode className="w-4 h-4" /> Generate Invoice
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="ln-invoice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                        <div className="flex items-center justify-between w-full">
                          <button onClick={() => { setInvoiceReady(false); }} className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowLeft className="w-3.5 h-3.5" /> Edit amount
                          </button>
                          <span className="text-sm font-semibold">{fmtSats(Number(lnAmount))}</span>
                        </div>
                        <div className="w-52 h-52 rounded-2xl bg-white p-4 shadow-float">
                          <FakeQR />
                        </div>
                        <div className="text-xs text-muted-foreground">Expires in <span className="text-foreground font-semibold">9:42</span></div>
                        <div className="w-full rounded-2xl bg-white/5 p-3 flex items-center gap-2">
                          <code className="flex-1 truncate text-xs text-muted-foreground">lnbc{lnAmount}u1p3xyz...0w8h</code>
                          <button
                            onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-xs font-medium shrink-0"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-[oklch(0.86_0.13_160)]" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Scan with any Lightning wallet or copy the invoice to pay.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Step 4: Processing */}
        {step === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="py-16 flex flex-col items-center gap-4">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary" />
              <div className="text-sm text-muted-foreground">Processing your deposit...</div>
              <div className="text-xs text-muted-foreground/60">Check your phone for a payment prompt.</div>
            </div>
          </motion.div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4 text-center">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-full grad-mint flex items-center justify-center shadow-glow-teal"
            >
              <Check className="w-10 h-10 text-background" strokeWidth={3} />
            </motion.div>
            <div className="text-xl font-semibold">Deposit confirmed</div>
            <div className="text-sm text-muted-foreground">Your stack just grew. Progress updated.</div>
            <div className="w-full rounded-2xl glass p-4 text-left flex flex-col gap-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Destination</span>
                <span className="text-foreground font-medium">{destLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Method</span>
                <span className="text-foreground font-medium">{tab === "momo" ? provider : "Lightning"}</span>
              </div>
              {tab === "momo" && (
                <>
                  <div className="flex justify-between">
                    <span>Phone</span>
                    <span className="text-foreground font-medium">+260 {phone}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between">
                    <span>Amount</span>
                    <span className="text-foreground font-medium">ZMW {amount}</span>
                  </div>
                </>
              )}
            </div>
            <button onClick={reset} className="mt-2 w-full grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral">
              Done
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </Sheet>
  );
}

function FakeQR() {
  return (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      {Array.from({ length: 32 * 32 }).map((_, i) => {
        const x = i % 32; const y = Math.floor(i / 32);
        const corner = (x < 7 && y < 7) || (x > 24 && y < 7) || (x < 7 && y > 24);
        const on = corner
          ? ((x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) ||
            (x > 24 && (x === 25 || x === 31 || y === 0 || y === 6 || (x >= 27 && x <= 29 && y >= 2 && y <= 4))) ||
            (y > 24 && (x === 0 || x === 6 || y === 25 || y === 31 || (x >= 2 && x <= 4 && y >= 27 && y <= 29))))
          : ((x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0);
        return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="black" /> : null;
      })}
    </svg>
  );
}
