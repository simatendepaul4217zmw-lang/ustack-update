import { motion } from "framer-motion";
import { useState } from "react";
import { Zap, ArrowLeftRight, Eye, EyeOff, Flame, ShieldCheck, TrendingUp, Loader2, ArrowDownToLine } from "lucide-react";
import { fmtSats, fmtBTC, type Vault } from "@/lib/ustack-data";
import { CountUp } from "../CountUp";
import { VaultCard } from "../VaultCard";
import { useWallet } from "@/lib/hooks/useAppData";
import { useVaults } from "@/lib/hooks/useAppData";
import { useActivity } from "@/lib/hooks/useAppData";
import { useBtcPrice } from "@/lib/hooks/useAppData";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/currency-context";

export function HomeScreen({ onOpenVault, onDeposit, onWithdraw, onCreateVault }: {
  onOpenVault: (v: Vault) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCreateVault: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const { user } = useAuth();
  const { data: wallet } = useWallet();
  const { data: vaults = [] } = useVaults();
  const { data: activityItems = [] } = useActivity();

  const { data: btcPrice } = useBtcPrice();
  const priceZmw = btcPrice?.priceZmw;
  const { fmtValue } = useCurrency();

  const totalSats = wallet?.totalSats ?? 0;
  const lockedSats = wallet?.lockedVaultSats ?? 0;
  const availableSats = (wallet?.availableSats ?? 0) + (wallet?.openVaultSats ?? 0);

  const monthlyStacked = vaults.reduce((sum, v) => sum + v.currentSats, 0);
  const monthlyGoal = vaults.reduce((sum, v) => sum + v.goalSats, 0) || 1;

  return (
    <div className="px-5 pt-2 flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <div className="text-sm text-muted-foreground">Hello, {user?.username ?? "stacker"}</div>
        <div className="text-xs text-muted-foreground/70">Keep stacking. Stay calm.</div>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative rounded-3xl p-6 bg-card overflow-hidden shadow-soft border border-white/5"
      >
        <div className="relative flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total stack</div>
          <button onClick={() => setHidden(!hidden)} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative mt-3 flex items-baseline gap-2">
          <div className="text-[2.6rem] font-semibold tracking-tight tabular-nums">
            {hidden ? "•••••" : <CountUp value={totalSats} format={fmtSats} />}
          </div>
          <div className="text-sm text-muted-foreground">sats</div>
        </div>
        <div className="relative -mt-1 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">≈ {fmtBTC(totalSats)} BTC</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-sm font-medium text-foreground/80">{hidden ? "•••" : fmtValue(totalSats, priceZmw)}</span>
        </div>
        {priceZmw && (
          <div className="relative mt-1 text-[10px] text-muted-foreground/50">
            ₿1 ≈ K{Math.round(priceZmw).toLocaleString()}
          </div>
        )}

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <Stat label="Locked" value={hidden ? "•••" : fmtSats(lockedSats)} zmw={hidden ? undefined : fmtValue(lockedSats, priceZmw)} accent="rose" />
          <Stat label="Available" value={hidden ? "•••" : fmtSats(availableSats)} zmw={hidden ? undefined : fmtValue(availableSats, priceZmw)} accent="teal" />
        </div>

        <div className="relative mt-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Vault progress</span>
            <span>{Math.round((monthlyStacked / monthlyGoal) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((monthlyStacked / monthlyGoal) * 100, 100)}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-primary"
            />
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between pt-4 border-t border-white/8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: "oklch(0.82 0.13 190)" }} />
            <span className="text-xs text-muted-foreground">Price Protection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "oklch(0.82 0.13 190)" }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.82 0.13 190)" }} />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "oklch(0.82 0.13 190)" }}>Active</span>
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction icon={Zap} label="Add Sats" onClick={onDeposit} accent="var(--primary)" />
        <QuickAction icon={ArrowLeftRight} label="Transfer" onClick={onWithdraw} accent="var(--primary)" />
      </div>

      {/* Vault carousel */}
      <div>
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-base font-semibold">My Vaults</div>
            <div className="text-xs text-muted-foreground">Slowly stacking · {vaults.length} active</div>
          </div>
          <button onClick={onCreateVault} className="text-xs text-primary font-semibold">+ New</button>
        </div>
        <div className="mt-3 -mx-5 px-5 flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {vaults.length === 0 ? (
            <div className="w-full text-center py-8 text-muted-foreground text-sm">No vaults yet. Create one!</div>
          ) : (
            vaults.map((v) => (
              <div key={v.id} className="shrink-0 w-[15rem]">
                <VaultCard vault={v} onClick={() => onOpenVault(v)} />
              </div>
            ))
          )}
          <button
            onClick={onCreateVault}
            className="shrink-0 w-[15rem] h-[12rem] rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-card/40 transition"
          >
            <div className="w-10 h-10 rounded-full glass flex items-center justify-center text-xl">+</div>
            <div className="text-sm">Create new vault</div>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-5 px-1 border-b border-white/5">
          {([
            ["activity", "Recent Activity"],
            ["insights", "Vault Insights"],
            ["tips", "Savings Tips"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="relative pb-3 text-sm font-medium">
              <span className={tab === k ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {tab === k && <motion.div layoutId="tab-ind" className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "activity" && (
            <div className="flex flex-col gap-2">
              {activityItems.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-6">No activity yet. Make your first deposit!</div>
              ) : (
                activityItems.slice(0, 4).map((a) => <ActivityRow key={a.id} a={a} />)
              )}
            </div>
          )}
          {tab === "insights" && <Insights vaults={vaults} />}
          {tab === "tips" && (
            <div className="flex flex-col gap-3">
              {tips.map((t, i) => (
                <div key={i} className="rounded-2xl glass p-4">
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, zmw, accent }: { label: string; value: string; zmw?: string; accent: string }) {
  const dotColor = accent === "teal" ? "oklch(0.78 0.14 170)" : "oklch(0.68 0.22 10)";
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} /> {label}
      </div>
      <div className="text-base font-semibold mt-1 tabular-nums">{value}</div>
      {zmw && <div className="text-[10px] text-muted-foreground/70 tabular-nums">{zmw}</div>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, accent }: { icon: typeof ArrowDownToLine; label: string; onClick: () => void; accent: string }) {
  return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={onClick} className="rounded-2xl glass-strong p-4 flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-xl bg-card border border-white/8 flex items-center justify-center" style={{ color: accent }}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-medium">{label}</span>
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
    <div className="rounded-2xl bg-card/60 p-3.5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-card border border-white/8 flex items-center justify-center" style={{ color: colorMap[a.kind] ?? "oklch(0.74 0.18 55)" }}>
        <Flame className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{a.title}</div>
        <div className="text-xs text-muted-foreground truncate">{a.meta}</div>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">{a.when}</div>
    </div>
  );
}

function Insights({ vaults }: { vaults: Vault[] }) {
  const maxStreak = vaults.reduce((m, v) => Math.max(m, v.streakDays), 0);
  const onTrack = vaults.filter((v) => v.currentSats / v.goalSats >= 0.2).length;
  const pct = vaults.length > 0 ? onTrack / vaults.length : 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl glass p-4">
        <div className="text-xs text-muted-foreground">Best Streak</div>
        <div className="text-2xl font-semibold mt-1">{maxStreak} days</div>
        <div className="text-xs text-muted-foreground mt-1">{maxStreak > 0 ? "Keep it going!" : "Start stacking"}</div>
      </div>
      <div className="rounded-2xl glass p-4 flex items-center gap-3">
        <ProgressRing value={pct} size={56} accent="teal">
          <span className="text-[10px] font-semibold">{Math.round(pct * 100)}%</span>
        </ProgressRing>
        <div>
          <div className="text-xs text-muted-foreground">Goals on track</div>
          <div className="text-sm font-semibold">{onTrack} of {vaults.length}</div>
        </div>
      </div>
      <div className="rounded-2xl glass p-4 col-span-2">
        <div className="text-xs text-muted-foreground">Stack growth (30d)</div>
        <div className="mt-3 flex items-end gap-1 h-16">
          {[20, 32, 28, 40, 36, 48, 44, 56, 52, 62, 58, 68].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.04, duration: 0.5 }}
              className="flex-1 rounded-md bg-accent/60"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
