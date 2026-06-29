import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown } from "lucide-react";
import { tips, fmtSats } from "@/lib/ustack-data";

const slideIn = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 320, damping: 32 } },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

function PageWrapper({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      key="detail-page"
      variants={slideIn}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-0 z-20 bg-background flex flex-col"
    >
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-white/5 shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {children}
      </div>
    </motion.div>
  );
}

interface Transaction { id: string; type: string; amountSats: number; status: string; method: string | null; when: string; }

export function AllHistoryPage({ transactions, onBack }: { transactions: Transaction[]; onBack: () => void }) {
  return (
    <PageWrapper title="All Transactions" onBack={onBack}>
      {transactions.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-12">No transactions yet.</div>
      ) : (
        transactions.map((t) => {
          const isDebit = t.type === "withdraw" || t.type === "send";
          const Icon = isDebit ? ArrowUpRight : ArrowDownLeft;
          const color = isDebit ? "oklch(0.68 0.22 10)" : "oklch(0.78 0.14 170)";
          const label = t.type === "deposit"
            ? (t.method === "lightning" ? "Lightning deposit" : t.method === "mobile_money" ? "MoMo deposit" : "Deposit")
            : t.type === "withdraw" ? "Withdrawal" : t.type === "send" ? "Sent" : t.type;
          return (
            <div key={t.id} className="rounded-xl bg-card/60 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color }}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{t.status}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold tabular-nums" style={{ color }}>{isDebit ? "−" : "+"}{fmtSats(t.amountSats)} sats</div>
                <div className="text-[10px] text-muted-foreground">{t.when}</div>
              </div>
            </div>
          );
        })
      )}
    </PageWrapper>
  );
}

const ALL_SNAPSHOTS = [
  { label: "7d ago",   change: -3.1 },
  { label: "14d ago",  change: -6.4 },
  { label: "30d ago",  change: -11.2 },
  { label: "90d ago",  change: -22.4 },
  { label: "180d ago", change: -31.7 },
  { label: "1yr ago",  change: -44.2 },
];

export function AllPricePage({ btcPrice, onBack }: { btcPrice: { priceUsd: number; priceZmw: number } | undefined; onBack: () => void }) {
  const priceUsd = btcPrice?.priceUsd ?? 0;
  const priceZmw = btcPrice?.priceZmw ?? 0;
  return (
    <PageWrapper title="Price Movements" onBack={onBack}>
      <div className="rounded-xl bg-card/60 p-4 flex items-center justify-between gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Bitcoin price now</div>
          <div className="text-2xl font-bold tabular-nums">{priceUsd > 0 ? `$${priceUsd.toLocaleString()}` : "—"}</div>
          {priceZmw > 0 && <div className="text-xs text-muted-foreground mt-0.5">≈ K{Math.round(priceZmw).toLocaleString()} ZMW</div>}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "oklch(0.82 0.17 140)" }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.82 0.17 140)" }} />
            </span>
            <span className="text-[10px] text-muted-foreground">Live · updates every 60s</span>
          </div>
        </div>
        <div className="shrink-0 w-20 h-20 rounded-full border-2 border-primary/30 bg-primary/10 flex flex-col items-center justify-center text-center gap-0.5">
          <div className="text-[9px] text-muted-foreground leading-none">1 ZMW =</div>
          <div className="text-[13px] font-bold tabular-nums text-primary leading-tight">
            {priceZmw > 0 ? `${Math.round(100_000_000 / priceZmw).toLocaleString()}` : "—"}
          </div>
          <div className="text-[8px] text-muted-foreground/70 leading-none">sats</div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground px-0.5 mb-1">Change vs today</div>
      {ALL_SNAPSHOTS.map((s) => {
        const pastPrice = priceUsd > 0 ? Math.round(priceUsd / (1 - s.change / 100)) : 0;
        const up = s.change >= 0;
        return (
          <div key={s.label} className="rounded-xl bg-card/60 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {up
                ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "oklch(0.78 0.14 170)" }} />
                : <TrendingDown className="w-3.5 h-3.5" style={{ color: "oklch(0.68 0.22 10)" }} />}
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold tabular-nums">{pastPrice > 0 ? `$${pastPrice.toLocaleString()}` : "—"}</div>
              <div className="text-[10px] tabular-nums" style={{ color: up ? "oklch(0.78 0.14 170)" : "oklch(0.68 0.22 10)" }}>
                {s.change > 0 ? "+" : ""}{s.change.toFixed(1)}% then
              </div>
            </div>
          </div>
        );
      })}
    </PageWrapper>
  );
}

const ALL_UPDATES = [
  { date: "Jun 29, 2026", title: "New tabs on home screen", body: "History, Price moves, and Updates tabs added to the home screen for a richer experience." },
  { date: "Jun 28, 2026", title: "PIN improvements", body: "Backspace and Enter buttons added to the PIN pad. App unlock no longer creates false security events." },
  { date: "Jun 27, 2026", title: "Growth tracker", body: "The home screen now shows real growth — your total sats vs what you deposited, so you can see your Bitcoin working." },
  { date: "Jun 25, 2026", title: "Price Protection active", body: "Automatic BTC price monitoring is live. If BTC drops 2%, your sats are shielded to USD automatically." },
  { date: "Jun 20, 2026", title: "Vault streaks", body: "Consecutive deposit streaks are now tracked per vault. Build your habit and watch the streak grow." },
  { date: "Jun 15, 2026", title: "Currency toggle", body: "Switch between sats, BTC, and ZMW display anytime from settings. Your balance, your format." },
  { date: "Jun 12, 2026", title: "Lightning deposits", body: "Instant deposits via the Lightning Network are now available. Deposit sats in seconds for near-zero fees." },
  { date: "Jun 10, 2026", title: "Mobile Money support", body: "Deposit kwacha via MTN or Airtel MoMo. Your kwacha is converted to sats automatically." },
  { date: "Jun 5,  2026", title: "Vault locking", body: "Lock a vault until a target date or goal is reached so you are not tempted to withdraw early." },
  { date: "Jun 1,  2026", title: "UStack launched 🎉", body: "UStack is live for Zambian students. Stack sats, set goals, lock your future." },
];

export function AllUpdatesPage({ onBack }: { onBack: () => void }) {
  return (
    <PageWrapper title="All Updates" onBack={onBack}>
      {ALL_UPDATES.map((u, i) => (
        <div key={i} className="rounded-xl glass p-3.5 flex gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
          <div>
            <div className="text-[9px] text-muted-foreground/60 mb-0.5">{u.date}</div>
            <div className="text-xs font-semibold">{u.title}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{u.body}</div>
          </div>
        </div>
      ))}
    </PageWrapper>
  );
}

export function AllTipsPage({ onBack }: { onBack: () => void }) {
  return (
    <PageWrapper title="All Tips" onBack={onBack}>
      {tips.map((t, i) => (
        <div key={i} className="rounded-xl glass p-3.5">
          <div className="text-xs font-semibold">{t.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t.body}</div>
        </div>
      ))}
    </PageWrapper>
  );
}
