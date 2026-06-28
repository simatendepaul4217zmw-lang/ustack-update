import { motion } from "framer-motion";
import { useState } from "react";
import { Zap, ArrowLeftRight, Eye, EyeOff, Flame, ShieldCheck, TrendingUp, Loader2, ArrowDownToLine } from "lucide-react";
import { tips, fmtSats, fmtBTC, type Vault } from "@/lib/ustack-data";
import { CountUp } from "../CountUp";
import { ProgressRing } from "../ProgressRing";
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
  const [tab, setTab] = useState<"activity" | "insights" | "tips">("activity");
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

  const lockedVaultCount = vaults.filter(v => v.locked).length;
  const openVaultCount = vaults.filter(v => !v.locked).length;

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
            <span>Vault progress</span>
            <span>{Math.round((monthlyStacked / monthlyGoal) * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((monthlyStacked / monthlyGoal) * 100, 100)}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-primary"
            />
          </div>
          {vaults.length > 0 && (
            <div className="mt-1 text-[9px] text-muted-foreground/60">
              {fmtSats(monthlyStacked)} sats added · {vaults.length} vault{vaults.length !== 1 ? "s" : ""}
            </div>
          )}
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
            ["insights", "Insights"],
            ["tips", "Tips"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="relative pb-2.5 text-xs font-medium">
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
          {tab === "insights" && <Insights vaults={vaults} />}
          {tab === "tips" && (
            <div className="flex flex-col gap-2">
              {tips.map((t, i) => (
                <div key={i} className="rounded-xl glass p-3.5">
                  <div className="text-xs font-semibold">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t.body}</div>
                </div>
              ))}
            </div>
          )}
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
