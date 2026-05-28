import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Send, Eye, EyeOff, Flame } from "lucide-react";
import { vaults, activity, tips, totalBalanceSats, lockedSats, availableSats, monthlyStackedSats, monthlyGoalSats, fmtSats, fmtBTC, type Vault } from "@/lib/ustack-data";
import { CountUp } from "../CountUp";
import { ProgressRing } from "../ProgressRing";
import { VaultCard } from "../VaultCard";

export function HomeScreen({ onOpenVault, onDeposit, onWithdraw, onCreateVault }: {
  onOpenVault: (v: Vault) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCreateVault: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState<"activity" | "insights" | "tips">("activity");

  return (
    <div className="px-5 pt-2 flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <div className="text-sm text-muted-foreground">Hello, Norman 👋</div>
        <div className="text-xs text-muted-foreground/70">Keep stacking. Stay calm.</div>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative rounded-3xl p-6 grad-hero overflow-hidden shadow-float border border-white/5"
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-40 blur-3xl" style={{ background: "var(--grad-coral)" }} />
        <div className="absolute -bottom-24 -left-10 w-48 h-48 rounded-full opacity-25 blur-3xl" style={{ background: "var(--grad-teal)" }} />

        <div className="relative flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total stack</div>
          <button onClick={() => setHidden(!hidden)} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative mt-3 flex items-baseline gap-2">
          <div className="text-[2.6rem] font-semibold tracking-tight tabular-nums">
            {hidden ? "•••••" : <CountUp value={totalBalanceSats} format={fmtSats} />}
          </div>
          <div className="text-sm text-muted-foreground">sats</div>
        </div>
        <div className="relative text-sm text-muted-foreground -mt-1">≈ {fmtBTC(totalBalanceSats)} BTC</div>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <Stat label="Locked" value={hidden ? "•••" : fmtSats(lockedSats)} accent="coral" />
          <Stat label="Available" value={hidden ? "•••" : fmtSats(availableSats)} accent="teal" />
        </div>

        {/* monthly progress */}
        <div className="relative mt-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>This month's stack</span>
            <span>{Math.round((monthlyStackedSats / monthlyGoalSats) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(monthlyStackedSats / monthlyGoalSats) * 100}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full grad-coral"
            />
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction icon={ArrowDownToLine} label="Deposit" onClick={onDeposit} grad="grad-coral" />
        <QuickAction icon={ArrowUpFromLine} label="Withdraw" onClick={onWithdraw} grad="grad-teal" />
        <QuickAction icon={Send} label="Send" onClick={onWithdraw} grad="grad-mint" />
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
          {vaults.map((v) => (
            <div key={v.id} className="shrink-0 w-[15rem]">
              <VaultCard vault={v} onClick={() => onOpenVault(v)} />
            </div>
          ))}
          <button
            onClick={onCreateVault}
            className="shrink-0 w-20 h-[12rem] rounded-3xl glass-strong shadow-float flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-white/10 transition relative z-10"
          >
            <div className="w-10 h-10 rounded-full grad-coral shadow-glow-coral flex items-center justify-center text-xl text-white font-light">+</div>
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
            <button
              key={k}
              onClick={() => setTab(k)}
              className="relative pb-3 text-sm font-medium"
            >
              <span className={tab === k ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {tab === k && <motion.div layoutId="tab-ind" className="absolute -bottom-px left-0 right-0 h-0.5 grad-coral rounded-full" />}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "activity" && (
            <div className="flex flex-col gap-2">
              {activity.slice(0, 4).map((a) => <ActivityRow key={a.id} a={a} />)}
            </div>
          )}
          {tab === "insights" && <Insights />}
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

function Stat({ label, value, accent }: { label: string; value: string; accent: "coral" | "teal" }) {
  const dot = accent === "coral" ? "bg-[oklch(0.74_0.18_25)]" : "bg-[oklch(0.78_0.14_190)]";
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
      </div>
      <div className="text-base font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, grad }: { icon: typeof ArrowDownToLine; label: string; onClick: () => void; grad: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="rounded-2xl glass-strong p-4 flex flex-col items-center gap-2"
    >
      <div className={`w-10 h-10 rounded-xl ${grad} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-background" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </motion.button>
  );
}

import type { Activity as ActivityT } from "@/lib/ustack-data";
function ActivityRow({ a }: { a: ActivityT }) {
  const map: Record<string, string> = {
    deposit: "grad-coral", milestone: "grad-mint", streak: "grad-btc",
    protection: "grad-teal", withdraw: "grad-teal", vault: "grad-coral",
  };
  return (
    <div className="rounded-2xl bg-card/60 p-3.5 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${map[a.kind]} flex items-center justify-center`}>
        <Flame className="w-4 h-4 text-background" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{a.title}</div>
        <div className="text-xs text-muted-foreground truncate">{a.meta}</div>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">{a.when}</div>
    </div>
  );
}

function Insights() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl glass p-4">
        <div className="text-xs text-muted-foreground">Streak</div>
        <div className="text-2xl font-semibold mt-1">41 days 🔥</div>
        <div className="text-xs text-muted-foreground mt-1">Longest yet</div>
      </div>
      <div className="rounded-2xl glass p-4 flex items-center gap-3">
        <ProgressRing value={0.68} size={56} accent="teal">
          <span className="text-[10px] font-semibold">68%</span>
        </ProgressRing>
        <div>
          <div className="text-xs text-muted-foreground">Goals on track</div>
          <div className="text-sm font-semibold">4 of 5</div>
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
              className="flex-1 rounded-md grad-mint opacity-90"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
