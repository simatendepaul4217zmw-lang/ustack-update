import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Zap, Copy, Check, Wallet, LayoutGrid,
  ChevronRight, TrendingUp, Lock, ArrowLeft, X as XIcon, QrCode, Loader2, CheckCircle2, ExternalLink
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Sheet } from "./Sheet";
import { fmtSats, satsToZMW, BTC_PRICE_ZMW, type Vault } from "@/lib/ustack-data";
import { useCurrency } from "@/lib/currency-context";
import { useVaults, useMobileMoneyDeposit, useCreateInvoice, useCheckInvoiceStatus, useCheckMomoStatus } from "@/lib/hooks/useAppData";
import { useBtcPrice } from "@/lib/hooks/useAppData";
import { ACCENT_COLORS, VaultIcon } from "@/lib/vault-theme";

type Step = "dest" | "vault" | "method" | "processing" | "done";
type Dest = "balance" | "vault";

const PROVIDERS = [
  { label: "Airtel", value: "airtel" as const },
  { label: "MTN MoMo", value: "mtn" as const },
  { label: "Zamtel", value: "zamtel" as const },
];
const QUICK_AMOUNTS = ["500", "1000", "2500", "5000"];

const WALLETS = [
  { name: "Blink",             bg: "bg-[#F7931A]",  initials: "BL", scheme: (inv: string) => `blink://lightning/${inv}` },
  { name: "Wallet of Satoshi", bg: "bg-[#7C3AED]",  initials: "WS", scheme: (inv: string) => `lightning:${inv}` },
  { name: "Muun",              bg: "bg-[#00C2A8]",  initials: "MU", scheme: (inv: string) => `muun://lightning/${inv}` },
  { name: "BlueWallet",        bg: "bg-[#1D6FE9]",  initials: "BW", scheme: (inv: string) => `bluewallet:lightning?lnurl=${inv}` },
  { name: "Phoenix",           bg: "bg-[#FF6B35]",  initials: "PH", scheme: (inv: string) => `phoenix://lightning/${inv}` },
  { name: "Other wallet",      bg: "bg-white/10",   initials: "...", scheme: (inv: string) => `lightning:${inv}` },
];

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
  const [tab, setTab] = useState<"momo" | "lightning">("lightning");
  const [provider, setProvider] = useState<"airtel" | "mtn" | "zamtel">("mtn");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("1000");
  const [lnAmount, setLnAmount] = useState("");
  const [invoiceData, setInvoiceData] = useState<{ paymentRequest: string; paymentHash: string; amountSats?: number; expiresAt?: string; mock?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [momoTxId, setMomoTxId] = useState<string | null>(null);

  const { data: vaults = [] } = useVaults();
  const { data: priceData } = useBtcPrice();
  const priceZmw = priceData?.priceZmw ?? BTC_PRICE_ZMW;
  const { fmtValue } = useCurrency();

  const momoDeposit = useMobileMoneyDeposit();
  const createInvoice = useCreateInvoice();
  const { data: invoiceStatus } = useCheckInvoiceStatus(invoiceData?.paymentHash ?? null);
  const { data: momoStatus } = useCheckMomoStatus(momoTxId);

  // Auto-advance to done when invoice is confirmed
  useEffect(() => {
    if (invoiceStatus?.status === "confirmed" && step === "method") {
      setStep("done");
    }
  }, [invoiceStatus?.status, step]);

  // Auto-advance to done when MoMo payment is confirmed
  useEffect(() => {
    if (momoStatus?.status === "SUCCESS" && step === "processing") {
      setStep("done");
    }
  }, [momoStatus?.status, step]);

  useEffect(() => {
    if (open && vaultContext) {
      setDest("vault");
      setSelectedVault(vaultContext);
      setStep("method");
    } else if (!open) {
      resetAll();
    }
  }, [open, vaultContext]);

  const resetAll = () => {
    setStep("dest"); setDest("balance"); setSelectedVault(null);
    setTab("momo"); setPhone(""); setAmount("1000"); setLnAmount("");
    setInvoiceData(null); setWalletPickerOpen(false); setError("");
    setMomoTxId(null);
  };

  const reset = () => { resetAll(); onClose(); };

  const selectDest = (d: Dest) => {
    setDest(d);
    if (d === "balance") { setSelectedVault(null); setStep("method"); }
    else setStep("vault");
  };

  const selectVault = (v: Vault) => { setSelectedVault(v); setStep("method"); setTab("lightning"); };
  const destLabel = dest === "balance" ? "Available Balance" : selectedVault?.name ?? "Vault";

  const canConfirm = () => {
    if (tab === "lightning") return !!invoiceData;
    return phone.trim().length >= 9 && Number(amount) > 0;
  };

  const confirm = async () => {
    setError("");
    setStep("processing");
    try {
      const zmwAmount = Number(amount);
      const amountSats = Math.round((zmwAmount / priceZmw) * 100_000_000);

      if (tab === "momo") {
        const result = await momoDeposit.mutateAsync({
          phone: phone.startsWith("+") ? phone : `+260${phone}`,
          amountSats,
          provider,
          vaultId: dest === "vault" && selectedVault ? selectedVault.id : undefined,
        });
        if (result.mock || !result.pending) {
          setStep("done");
        } else {
          // pending — set transaction ID for polling; stay on "processing"
          setMomoTxId(result.transactionId ?? null);
        }
        return;
      }
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deposit failed");
      setStep("method");
    }
  };

  const generateInvoiceNow = async () => {
    if (!lnAmount || Number(lnAmount) <= 0) return;
    try {
      const result = await createInvoice.mutateAsync({
        amountSats: Number(lnAmount),
        memo: dest === "vault" && selectedVault ? `Deposit to ${selectedVault.name}` : "UStack deposit",
        vaultId: dest === "vault" && selectedVault ? selectedVault.id : undefined,
      });
      setInvoiceData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate invoice");
    }
  };

  const handleGenerateInvoice = () => {
    generateInvoiceNow();
  };

  const titleMap: Record<Step, string> = {
    dest: "Add Sats", vault: "Select Vault", method: destLabel, processing: "Add Sats", done: "Add Sats",
  };

  return (
    <Sheet open={open} onClose={reset} title={titleMap[step]}>
      <AnimatePresence mode="wait">

        {/* Step 1: Destination picker */}
        {step === "dest" && (
          <motion.div key="dest" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-sm text-muted-foreground mb-5">Where should the funds go?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => selectDest("balance")} className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10">
                <div className="w-12 h-12 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color: "oklch(0.82 0.17 140)" }}>
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Available Balance</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Add sats directly to your available balance</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>

              <button onClick={() => selectDest("vault")} className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition active:scale-[0.98] border border-transparent hover:border-white/10">
                <div className="w-12 h-12 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color: "oklch(0.73 0.19 55)" }}>
                  <LayoutGrid className="w-6 h-6" />
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
            <button onClick={() => setStep("dest")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <p className="text-sm text-muted-foreground mb-4">Choose which vault to deposit into.</p>
            <div className="flex flex-col gap-2">
              {vaults.map((v) => {
                const p = v.currentSats / v.goalSats;
                return (
                  <button key={v.id} onClick={() => selectVault(v)} className="flex items-center gap-3 rounded-2xl glass p-4 text-left transition active:scale-[0.98]">
                    <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${ACCENT_COLORS[v.accent] ?? ACCENT_COLORS.btc}20`, border: `1px solid ${ACCENT_COLORS[v.accent] ?? ACCENT_COLORS.btc}40`, color: ACCENT_COLORS[v.accent] ?? ACCENT_COLORS.btc }}><VaultIcon name={v.emoji} className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{v.name}</span>
                        {v.locked && <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground shrink-0"><Lock className="w-2.5 h-2.5" /> Locked</span>}
                        {!v.locked && <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-[oklch(0.82_0.13_190)] bg-[oklch(0.82_0.13_190)]/10 shrink-0"><TrendingUp className="w-2.5 h-2.5" /> {v.type === "stack" ? "Stack" : "Hodl"}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtSats(v.currentSats)} · {Math.round(p * 100)}% of goal</div>
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

        {/* Step 3: Payment method */}
        {step === "method" && (
          <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {!vaultContext && (
              <button onClick={() => dest === "balance" ? setStep("dest") : setStep("vault")} className="flex items-center gap-1 text-xs text-muted-foreground mb-4"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            )}
            {dest === "vault" && selectedVault && (
              <div className="rounded-2xl p-4 bg-card border border-white/8 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Adding sats into</span>
                  <span className="font-semibold text-foreground">{selectedVault.name}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
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
                  <button key={k} onClick={() => { setTab(k); setInvoiceData(null); setLnAmount(""); }} className="relative flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
                    {active && <motion.div layoutId="dep-tab" className="absolute inset-0 bg-primary rounded-xl" />}
                    <Icon className={`relative w-4 h-4 ${active ? "text-background" : "text-muted-foreground"}`} />
                    <span className={`relative ${active ? "text-background" : "text-muted-foreground"}`}>{label}</span>
                  </button>
                );
              })}
            </div>

            {error && <p className="mb-3 text-sm text-destructive text-center">{error}</p>}

            <AnimatePresence mode="wait">
              {tab === "momo" ? (
                <motion.div key="momo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                  {/* Provider picker */}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Network</div>
                    <div className="grid grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => (
                        <button key={p.value} onClick={() => setProvider(p.value)} className={`py-2.5 rounded-xl text-sm font-medium transition border ${provider === p.value ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 text-muted-foreground border-white/8 hover:border-white/20"}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone number */}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Phone Number</div>
                    <div className="rounded-2xl glass p-4 flex items-center gap-3">
                      <span className="text-sm text-muted-foreground shrink-0 font-mono">+260</span>
                      <input
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                        placeholder="97 123 4567"
                        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 font-mono"
                      />
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amount (ZMW)</div>
                    <div className="rounded-2xl glass p-5 flex items-center justify-center gap-2">
                      <span className="text-lg text-muted-foreground">K</span>
                      <input
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                        className="bg-transparent text-3xl font-semibold text-center tabular-nums focus:outline-none w-36"
                        placeholder="0"
                      />
                    </div>
                    {Number(amount) > 0 && (
                      <div className="mt-1 text-center text-xs font-medium text-foreground/70 tabular-nums">
                        ≈ {Math.round((Number(amount) / priceZmw) * 100_000_000).toLocaleString()} sats
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      {QUICK_AMOUNTS.map((q) => (
                        <button key={q} onClick={() => setAmount(q)} className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition ${amount === q ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/8 text-muted-foreground hover:border-white/20"}`}>
                          K{q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive text-center">{error}</p>}

                  <div className="rounded-xl bg-white/5 border border-white/8 px-4 py-3 flex items-start gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">You'll receive a USSD prompt on your phone. Approve it to complete the deposit.</p>
                  </div>

                  <button
                    disabled={!canConfirm() || momoDeposit.isPending}
                    onClick={confirm}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40"
                  >
                    {momoDeposit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Smartphone className="w-4 h-4" /> Send USSD Prompt</>}
                  </button>
                </motion.div>
              ) : (
                <motion.div key="ln" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                  <AnimatePresence mode="wait">
                    {!invoiceData ? (
                      <motion.div key="ln-amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Amount (sats)</div>
                          <div className="rounded-2xl glass p-5 flex items-center justify-center gap-2">
                            <input inputMode="numeric" value={lnAmount} onChange={(e) => setLnAmount(e.target.value.replace(/\D/g, ""))} className="bg-transparent text-3xl font-semibold text-center tabular-nums focus:outline-none w-44" placeholder="0" />
                            <span className="text-sm text-muted-foreground">sats</span>
                          </div>
                          {Number(lnAmount) > 0 && (
                            <div className="mt-1 text-center text-xs font-medium text-foreground/70 tabular-nums">{fmtValue(Number(lnAmount), priceZmw)}</div>
                          )}
                        </div>
                        <button disabled={!lnAmount || Number(lnAmount) <= 0 || createInvoice.isPending} onClick={handleGenerateInvoice} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40">
                          {createInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><QrCode className="w-4 h-4" /> Generate Invoice</>}
                        </button>
                      </motion.div>
                    ) : invoiceStatus?.status === "confirmed" ? (
                      <motion.div key="ln-paid" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-4 text-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }} className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.86 0.13 160)" }}>
                          <CheckCircle2 className="w-10 h-10" />
                        </motion.div>
                        <div className="text-xl font-semibold">Payment received!</div>
                        <div className="text-sm text-muted-foreground">{fmtSats(Number(lnAmount))} added to your {dest === "vault" && selectedVault ? selectedVault.name : "balance"}.</div>
                        <button onClick={reset} className="mt-2 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">Done</button>
                      </motion.div>
                    ) : (
                      <motion.div key="ln-invoice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                        <div className="flex items-center justify-between w-full">
                          <button onClick={() => setInvoiceData(null)} className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="w-3.5 h-3.5" /> Edit amount</button>
                          <span className="text-sm font-semibold">{fmtSats(Number(lnAmount))}</span>
                        </div>
                        {/* Dev: mock payment hash for testing */}
                        {invoiceData.mock && (
                          <div className="w-full glass rounded-xl px-4 py-2.5 flex items-start gap-2">
                            <span className="text-xs text-muted-foreground shrink-0">Mock hash:</span>
                            <span className="font-mono text-xs text-primary break-all">{invoiceData.paymentHash}</span>
                          </div>
                        )}
                        <div className="w-52 h-52 rounded-2xl bg-white p-3 shadow-float flex items-center justify-center">
                          <QRCodeSVG
                            value={invoiceData.paymentRequest.toUpperCase()}
                            size={192}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="M"
                          />
                        </div>
                        {/* Waiting indicator */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Waiting for payment…
                        </div>
                        <div className="w-full rounded-2xl bg-white/5 p-3 flex items-center gap-2">
                          <code className="flex-1 truncate text-xs text-muted-foreground">{invoiceData.paymentRequest.slice(0, 40)}…</code>
                          <button onClick={() => { navigator.clipboard.writeText(invoiceData.paymentRequest); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-xs font-medium shrink-0">
                            {copied ? <Check className="w-3.5 h-3.5 text-[oklch(0.86_0.13_160)]" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Scan with any Lightning wallet or tap Pay Now.</p>
                        <button onClick={() => setWalletPickerOpen(true)} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition">
                          <Zap className="w-4 h-4" /> Pay Now
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Processing */}
        {step === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="py-12 flex flex-col items-center gap-5">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} className="w-12 h-12 rounded-full border-4 border-white/10 border-t-primary" />
              {tab === "momo" && momoTxId ? (
                <>
                  <div className="text-sm font-semibold text-center">Check your phone</div>
                  <p className="text-xs text-muted-foreground text-center max-w-[220px]">Approve the USSD prompt on your phone to complete the deposit.</p>
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Waiting for confirmation…
                  </motion.div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Adding your sats...</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }} className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.86 0.13 160)" }}>
              <Check className="w-10 h-10" strokeWidth={3} />
            </motion.div>
            <div className="text-xl font-semibold">Sats added!</div>
            <div className="text-sm text-muted-foreground">Your stack just grew. Progress updated.</div>
            <div className="w-full rounded-2xl glass p-4 text-left flex flex-col gap-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Destination</span><span className="text-foreground font-medium">{destLabel}</span></div>
              <div className="flex justify-between"><span>Method</span><span className="text-foreground font-medium">{tab === "momo" ? PROVIDERS.find(p => p.value === provider)?.label : "Lightning"}</span></div>
              {tab === "momo" && <><div className="flex justify-between"><span>Phone</span><span className="text-foreground font-medium">+260 {phone}</span></div><div className="h-px bg-white/10" /><div className="flex justify-between"><span>Amount</span><span className="text-foreground font-medium">ZMW {amount}</span></div></>}
            </div>
            <button onClick={reset} className="mt-2 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">Done</button>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Wallet picker popup */}
      <AnimatePresence>
        {walletPickerOpen && invoiceData && (
          <>
            {/* Backdrop */}
            <motion.div
              key="wallet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setWalletPickerOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            {/* Popup panel */}
            <motion.div
              key="wallet-popup"
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[61] mx-auto max-w-sm w-full px-4 pb-8"
            >
              <div className="rounded-3xl bg-[oklch(0.14_0.01_260)] border border-white/10 shadow-float overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
                  <div>
                    <div className="text-base font-semibold">Choose a wallet</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Open in your Lightning wallet app</div>
                  </div>
                  <button
                    onClick={() => setWalletPickerOpen(false)}
                    className="w-8 h-8 rounded-full glass flex items-center justify-center"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
                {/* Wallet list */}
                <div className="px-4 py-3 flex flex-col gap-2">
                  {WALLETS.map((w) => (
                    <motion.button
                      key={w.name}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        try { window.open(w.scheme(invoiceData.paymentRequest), "_blank"); } catch {}
                        setWalletPickerOpen(false);
                      }}
                      className="flex items-center gap-3 rounded-2xl bg-white/5 hover:bg-white/8 border border-white/5 px-4 py-3.5 text-left transition"
                    >
                      <div className={`w-10 h-10 rounded-xl ${w.bg} flex items-center justify-center shrink-0`}>
                        <span className="text-[11px] font-bold text-white">{w.initials}</span>
                      </div>
                      <span className="flex-1 text-sm font-medium">{w.name}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function FakeQR() {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const row = Math.floor(i / 21); const col = i % 21;
    const corner = (row < 7 && col < 7) || (row < 7 && col > 13) || (row > 13 && col < 7);
    return corner ? true : Math.random() > 0.5;
  });
  return (
    <div className="w-full h-full grid" style={{ gridTemplateColumns: "repeat(21, 1fr)", gap: 1 }}>
      {cells.map((dark, i) => <div key={i} className={`rounded-sm ${dark ? "bg-black" : "bg-white"}`} />)}
    </div>
  );
}
