import { motion } from "framer-motion";
import { useState } from "react";
import { Zap, ArrowLeftRight, Eye, EyeOff, Flame, ShieldCheck, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { tips, fmtSats, fmtBTC, type Vault } from "@/lib/ustack-data";
import { CountUp } from "../CountUp";
import { ProgressRing } from "../ProgressRing";
import { VaultCard } from "../VaultCard";
import { useWallet, useVaults, useActivity, useBtcPrice, useTransactions } from "@/lib/hooks/useAppData";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/currency-context";

export function HomeScreen({ onOpenVault, onDeposit, onWithdraw, onCreateVault }: {
  onOpenVault: (v: Vault) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCreateVault: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState<"activity" | "insights" | "tips" | "history" | "price" | "updates">("activity");
  const { user } = useAuth();
  const { data: wallet } = useWallet();
  const { data: vaults = [] } = useVaults();
  const { data: activityItems = [] } = useActivity();
  const { data: transactions = [] } = useTransactions();

  const { data: btcPrice } = useBtcPrice();
  const priceZmw = btcPrice?.priceZmw;
  const { fmtValue } = useCurrency();

  const totalSats = wallet?.totalSats ?? 0;
  const lockedSats = wallet?.lockedVaultSats ?? 0;
  const availableSats = (wallet?.availableSats ?? 0) + (wallet?.openVaultSats ?? 0);
  const totalDeposited = wallet?.totalDeposited ?? 0;

  const lockedVaultCount = vaults.filter(v => v.locked).length;
  const openVaultCount = vaults.filter(v => !v.locked).length;

  const growthSats = totalSats - totalDeposited;
  const growthPct = totalDeposited > 0 ? (growthSats / totalDeposited) * 100 : 0;
  const growthBarPct = Math.min(Math.max(growthPct, 0), 100);

  return (
    <div className="px-4 pt-1 flex flex-col gap-4">
      {/* Greeting */}
      <div>
        <div className="text-sm text-muted-foreground">Hello, {user?.username ?? "stacker"}</div>
        <div className="text-[10px] text-muted-foreground/60">Keep stacking. Stay calm.</div>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative rounded-2xl p-4 bg-card overflow-hidden shadow-soft border border-white/5"
      >
        <div className="relative flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total stack</div>
          <button onClick={() => setHidden(!hidden)} className="w-7 h-7 rounded-full glass flex items-center justify-center">
            {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="relative mt-2 flex items-baseline gap-1.5">
          <div className="text-[2rem] font-semibold tracking-tight tabular-nums leading-none">
            {hidden ? "•••••" : <CountUp value={totalSats} format={fmtSats} />}
          </div>
          <div className="text-xs text-muted-foreground">sats</div>
        </div>
        <div className="relative mt-0.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">≈ {fmtBTC(totalSats)} BTC</span>
          <span className="text-white/20 text-[10px]">·</span>
          <span className="text-xs font-medium text-foreground/80">{hidden ? "•••" : fmtValue(totalSats, priceZmw)}</span>
        </div>
        {priceZmw && (
          <div className="relative mt-0.5 text-[9px] text-muted-foreground/50">
            ₿1 ≈ K{Math.round(priceZmw).toLocaleString()}
          </div>
        )}

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <Stat label="Locked" value={hidden ? "•••" : fmtSats(lockedSats)} zmw={hidden ? undefined : fmtValue(lockedSats, priceZmw)} accent="rose" sub={lockedVaultCount > 0 ? `from ${lockedVaultCount} vault${lockedVaultCount !== 1 ? "s" : ""}` : undefined} />
          <Stat label="Available" value={hidden ? "•••" : fmtSats(availableSats)} zmw={hidden ? undefined : fmtValue(availableSats, priceZmw)} accent="teal" sub={openVaultCount > 0 ? `from ${openVaultCount} vault${openVaultCount !== 1 ? "s" : ""}` : undefined} />
        </div>

        <div className="relative mt-4">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Growth</span>
            <span className={growthPct >= 0 ? "text-[oklch(0.78_0.14_170)]" : "text-[oklch(0.68_0.22_10)]"}>
              {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${growthBarPct}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
              style={{ background: growthPct >= 0 ? "oklch(0.78 0.14 170)" : "oklch(0.68 0.22 10)" }}
            />
          </div>
          <div className="mt-1 text-[9px] text-muted-foreground/60">
            {totalDeposited > 0
              ? `${fmtSats(totalDeposited)} deposited · ${fmtSats(totalSats)} now`
              : "No deposits yet"}
          </div>
        </div>

        <div className="relative mt-3 flex items-center justify-between pt-3 border-t border-white/8">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "oklch(0.82 0.17 140)" }} />
            <span className="text-[10px] text-muted-foreground">Price Protection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "oklch(0.82 0.17 140)" }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.82 0.17 140)" }} />
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "oklch(0.82 0.17 140)" }}>Active</span>
          </div>
        </div>
      </motion.div>

      {/* Quick actions — rectangular */}
      <div className="grid grid-cols-2 gap-2">
        <QuickAction icon={Zap} label="Add Sats" onClick={onDeposit} primary />
        <QuickAction icon={ArrowLeftRight} label="Transfer" onClick={onWithdraw} />
      </div>

      {/* Vault carousel */}
      <div>
        <div className="flex items-center justify-between px-0.5 mb-2">
          <div>
            <div className="text-sm font-semibold">My Vaults</div>
            <div className="text-[10px] text-muted-foreground">{vaults.length} active</div>
          </div>
          <button onClick={onCreateVault} className="text-xs text-primary font-semibold">+ New</button>
        </div>
        <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {vaults.length === 0 ? (
            <div className="w-full text-center py-6 text-muted-foreground text-sm">No vaults yet. Create one!</div>
          ) : (
            vaults.map((v) => (
              <div key={v.id} className="shrink-0 w-[13rem]">
                <VaultCard vault={v} onClick={() => onOpenVault(v)} />
              </div>
            ))
          )}
          <button
            onClick={onCreateVault}
            className="shrink-0 w-[5.5rem] h-[10.5rem] rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-card/40 transition"
          >
            <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-lg">+</div>
            <div className="text-xs">New vault</div>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-4 px-0.5 border-b border-white/5">
          {([
            ["activity", "Activity"],
            ["history", "History"],
            ["price", "Price moves"],
            ["insights", "Insights"],
            ["updates", "Updates"],
            ["tips", "Tips"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="relative pb-2.5 text-xs font-medium shrink-0">
              <span className={tab === k ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {tab === k && <motion.div layoutId="tab-ind" className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {tab === "activity" && (
            <div className="flex flex-col gap-2">
              {activityItems.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-5">No activity yet. Make your first deposit!</div>
              ) : (
                activityItems.slice(0, 4).map((a) => <ActivityRow key={a.id} a={a} />)
              )}
            </div>
          )}
          {tab === "history" && <TransactionHistory transactions={transactions} />}
          {tab === "price" && <PriceTab btcPrice={btcPrice} fmtValue={fmtValue} />}
          {tab === "insights" && <Insights vaults={vaults} />}
          {tab === "updates" && <Updates />}
          {tab === "tips" && <Tips />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, zmw, sub, accent }: { label: string; value: string; zmw?: string; sub?: string; accent: string }) {
  const dotColor = accent === "teal" ? "oklch(0.78 0.14 170)" : "oklch(0.68 0.22 10)";
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} /> {label}
      </div>
      <div className="text-sm font-semibold mt-0.5 tabular-nums">{value}</div>
      {zmw && <div className="text-[9px] text-muted-foreground/70 tabular-nums">{zmw}</div>}
      {sub && <div className="text-[9px] text-muted-foreground/50 mt-0.5">{sub}</div>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, primary }: { icon: typeof ArrowDownToLine; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`rounded-xl px-4 py-3 flex items-center justify-center gap-2.5 w-full font-semibold text-sm transition ${
        primary
          ? "bg-primary text-primary-foreground"
          : "glass-strong text-foreground"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </motion.button>
  );
}

interface ActivityItem {
  id: string; kind: string; title: string; meta: string; when: string;
}
function ActivityRow({ a }: { a: ActivityItem }) {
  const colorMap: Record<string, string> = {
    deposit: "oklch(0.74 0.18 55)", milestone: "oklch(0.78 0.14 170)", streak: "oklch(0.74 0.18 55)",
    protection: "oklch(0.78 0.14 170)", withdraw: "oklch(0.68 0.22 300)", vault: "oklch(0.74 0.18 55)",
    vault_deposit: "oklch(0.74 0.18 55)", vault_withdraw: "oklch(0.68 0.22 300)", vault_created: "oklch(0.78 0.14 170)",
    login: "oklch(0.72 0.16 250)",
  };
  return (
    <div className="rounded-xl bg-card/60 p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color: colorMap[a.kind] ?? "oklch(0.74 0.18 55)" }}>
        <Flame className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{a.title}</div>
        <div className="text-[10px] text-muted-foreground truncate">{a.meta}</div>
      </div>
      <div className="text-[10px] text-muted-foreground shrink-0">{a.when}</div>
    </div>
  );
}

function Insights({ vaults }: { vaults: Vault[] }) {
  const maxStreak = vaults.reduce((m, v) => Math.max(m, v.streakDays), 0);
  const onTrack = vaults.filter((v) => v.currentSats / v.goalSats >= 0.2).length;
  const pct = vaults.length > 0 ? onTrack / vaults.length : 0;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl glass p-3.5">
        <div className="text-[10px] text-muted-foreground">Best Streak</div>
        <div className="text-xl font-semibold mt-1">{maxStreak} days</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{maxStreak > 0 ? "Keep it going!" : "Start stacking"}</div>
      </div>
      <div className="rounded-xl glass p-3.5 flex items-center gap-2.5">
        <ProgressRing value={pct} size={48} accent="teal">
          <span className="text-[9px] font-semibold">{Math.round(pct * 100)}%</span>
        </ProgressRing>
        <div>
          <div className="text-[10px] text-muted-foreground">On track</div>
          <div className="text-xs font-semibold">{onTrack} of {vaults.length}</div>
        </div>
      </div>
      <div className="rounded-xl glass p-3.5 col-span-2">
        <div className="text-[10px] text-muted-foreground">Stack growth (30d)</div>
        <div className="mt-2.5 flex items-end gap-1 h-12">
          {[20, 32, 28, 40, 36, 48, 44, 56, 52, 62, 58, 68].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.04, duration: 0.5 }}
              className="flex-1 rounded-sm bg-accent/60"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface Transaction { id: string; type: string; amountSats: number; status: string; method: string | null; when: string; }

function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  const [expanded, setExpanded] = useState(false);
  if (transactions.length === 0) return (
    <div className="text-center text-muted-foreground text-sm py-8">No transactions yet.</div>
  );
  const LIMIT = 6;
  const visible = expanded ? transactions : transactions.slice(0, LIMIT);
  const hasMore = transactions.length > LIMIT;
  return (
    <div className="flex flex-col gap-2">
      {visible.map((t) => {
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
      })}
      {hasMore && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-primary font-medium py-2 text-center">
          {expanded ? "Show less" : "View all"}
        </button>
      )}
    </div>
  );
}

function PriceTab({ btcPrice, fmtValue: _fmtValue }: { btcPrice: { priceUsd: number; priceZmw: number } | undefined; fmtValue: (sats: number, priceZmw?: number) => string }) {
  const [expanded, setExpanded] = useState(false);
  const priceUsd = btcPrice?.priceUsd ?? 0;
  const priceZmw = btcPrice?.priceZmw ?? 0;
  const snapshots = [
    { label: "7d ago",   change: -3.1 },
    { label: "14d ago",  change: -6.4 },
    { label: "30d ago",  change: -11.2 },
    { label: "90d ago",  change: -22.4 },
    { label: "180d ago", change: -31.7 },
    { label: "1yr ago",  change: -44.2 },
  ];
  const LIMIT = 3;
  const visible = expanded ? snapshots : snapshots.slice(0, LIMIT);
  const hasMore = snapshots.length > LIMIT;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-card/60 p-4 flex items-center justify-between gap-3">
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
      <div className="text-[10px] text-muted-foreground px-0.5">Change vs today</div>
      {visible.map((s) => {
        const pastPrice = priceUsd > 0 ? Math.round(priceUsd / (1 - s.change / 100)) : 0;
        const up = s.change >= 0;
        return (
          <div key={s.label} className="rounded-xl bg-card/60 px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {up ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "oklch(0.78 0.14 170)" }} /> : <TrendingDown className="w-3.5 h-3.5" style={{ color: "oklch(0.68 0.22 10)" }} />}
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
      {hasMore && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-primary font-medium py-2 text-center">
          {expanded ? "Show less" : "View all"}
        </button>
      )}
    </div>
  );
}

function Updates() {
  const [expanded, setExpanded] = useState(false);
  const items = [
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
  const LIMIT = 6;
  const visible = expanded ? items : items.slice(0, LIMIT);
  const hasMore = items.length > LIMIT;
  return (
    <div className="flex flex-col gap-2">
      {visible.map((u, i) => (
        <div key={i} className="rounded-xl glass p-3.5 flex gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
          <div>
            <div className="text-[9px] text-muted-foreground/60 mb-0.5">{u.date}</div>
            <div className="text-xs font-semibold">{u.title}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{u.body}</div>
          </div>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary font-medium py-2 text-center"
        >
          {expanded ? "Show less" : "View all"}
        </button>
      )}
    </div>
  );
}

function Tips() {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 6;
  const visible = expanded ? tips : tips.slice(0, LIMIT);
  const hasMore = tips.length > LIMIT;
  return (
    <div className="flex flex-col gap-2">
      {visible.map((t, i) => (
        <div key={i} className="rounded-xl glass p-3.5">
          <div className="text-xs font-semibold">{t.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t.body}</div>
        </div>
      ))}
      {hasMore && (
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-primary font-medium py-2 text-center">
          {expanded ? "Show less" : "View all"}
        </button>
      )}
    </div>
  );
}
