import { Lock, TrendingUp, Calendar, Flame, Zap, ArrowLeftRight, Trophy, Check, Clock, Target } from "lucide-react";
import { Sheet } from "./Sheet";
import { ProgressRing } from "../ProgressRing";
import type { Vault } from "@/lib/ustack-data";
import { useBtcPrice } from "@/lib/hooks/useAppData";
import { useCurrency } from "@/lib/currency-context";
import { ACCENT_COLORS, VaultIcon } from "@/lib/vault-theme";

export function VaultDetailSheet({ open, vault, onClose, onDeposit, onWithdraw }: {
  open: boolean; vault: Vault | null; onClose: () => void; onDeposit: () => void; onWithdraw: () => void;
}) {
  const { data: btcPrice } = useBtcPrice();
  const priceZmw = btcPrice?.priceZmw;
  const { fmtValue } = useCurrency();

  if (!vault) return <Sheet open={open} onClose={onClose}><div /></Sheet>;

  const accent = ACCENT_COLORS[vault.accent] ?? ACCENT_COLORS.btc;
  const satsPct = vault.goalSats > 0 ? vault.currentSats / vault.goalSats : 0;

  // Hodl → ring tracks time through lock; Stack → ring tracks sats toward goal
  const ringPct = vault.type === "hodl"
    ? (vault.lockProgressPct ?? 0)
    : satsPct;

  // Human-readable lock-end date
  const lockEndDate = vault.lockedUntil
    ? new Date(vault.lockedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  // Milestones: hodl → time checkpoints; stack → sats checkpoints
  const milestones = vault.type === "hodl"
    ? [
        { label: "25%", threshold: 0.25, pct: ringPct },
        { label: "50%", threshold: 0.50, pct: ringPct },
        { label: "75%", threshold: 0.75, pct: ringPct },
        { label: "Unlock", threshold: 1.00, pct: ringPct },
      ]
    : [
        { label: "25%", threshold: 0.25, pct: satsPct },
        { label: "50%", threshold: 0.50, pct: satsPct },
        { label: "75%", threshold: 0.75, pct: satsPct },
        { label: "Goal!", threshold: 1.00, pct: satsPct },
      ];

  return (
    <Sheet open={open} onClose={onClose} title={vault.name}>

      {/* Hero card */}
      <div className="relative rounded-3xl p-6 bg-card overflow-hidden shadow-soft border border-white/5">
        <div className="flex items-center gap-5">
          <ProgressRing value={ringPct} size={112} stroke={10} accent={vault.accent}>
            <div className="text-center px-1">
              {vault.type === "hodl" ? (
                <>
                  <div className="text-lg font-semibold tabular-nums leading-none">{vault.daysRemaining}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">days left</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">{Math.round(ringPct * 100)}% done</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-semibold tabular-nums leading-none">{Math.round(satsPct * 100)}%</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">of goal</div>
                </>
              )}
            </div>
          </ProgressRing>

          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              {vault.type === "hodl" ? <Lock className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {vault.type === "hodl" ? "Hodl Vault" : "Stack Vault"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span style={{ color: accent }}><VaultIcon name={vault.emoji} className="w-4 h-4" /></span>
              <div className="text-xl font-semibold tabular-nums">{fmtValue(vault.currentSats, priceZmw)}</div>
            </div>
            <div className="text-xs text-muted-foreground">{vault.currentSats.toLocaleString()} sats</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">
              of {vault.goalSats.toLocaleString()} sats goal
            </div>
          </div>
        </div>

        {/* Sats progress bar (always visible, shows deposit progress toward goal) */}
        <div className="mt-5">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>{vault.type === "hodl" ? "Sats deposited" : "Progress to goal"}</span>
            <span>{Math.round(satsPct * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(satsPct, 1) * 100}%`, background: accent }}
            />
          </div>
        </div>

        {/* Lock end date for hodl vaults */}
        {vault.type === "hodl" && lockEndDate && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Unlocks {lockEndDate}</span>
          </div>
        )}
      </div>

      {/* Stats tiles */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {vault.type === "hodl" ? (
          <>
            <Tile icon={Clock}   label="Days left"   value={`${vault.daysRemaining}d`} />
            <Tile icon={Flame}   label="Streak"      value={`${vault.streakDays}d`} />
            <Tile icon={Trophy}  label="Time done"   value={`${Math.round(ringPct * 100)}%`} />
          </>
        ) : (
          <>
            <Tile icon={Flame}   label="Streak"      value={`${vault.streakDays}d`} />
            <Tile icon={Target}  label="Goal"        value={`${Math.round(satsPct * 100)}%`} />
            <Tile icon={Calendar} label="Days active" value={`${vault.daysSinceCreated ?? 0}d`} />
          </>
        )}
      </div>

      {/* Milestones */}
      <div className="mt-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          {vault.type === "hodl" ? "Lock milestones" : "Stacking milestones"}
        </div>
        <div className="flex gap-2">
          {milestones.map((m, i) => {
            const hit = m.pct >= m.threshold;
            return (
              <div
                key={i}
                className={`flex-1 rounded-xl p-3 text-center border transition ${hit ? "bg-card border-primary/30" : "bg-card/40 border-transparent"}`}
              >
                <div className="text-xs font-semibold">{m.label}</div>
                <div className="flex justify-center mt-0.5">
                  {hit
                    ? <Check className="w-3 h-3 text-primary" strokeWidth={3} />
                    : <span className="text-[10px] text-muted-foreground/40">–</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Penalty notice */}
      {vault.locked && (
        <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {vault.type === "hodl"
              ? `This vault is time-locked until ${lockEndDate}. Early withdrawal carries a ${vault.penaltyPct ?? 45}% penalty.`
              : `This vault is still working toward its goal. Withdrawing early carries a ${vault.penaltyPct ?? 45}% penalty.`}
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button onClick={onDeposit} className="flex-1 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl flex items-center justify-center gap-2">
          <Zap className="w-4 h-4" /> Add Sats
        </button>
        <button onClick={onWithdraw} className="flex-1 glass font-semibold py-4 rounded-2xl flex items-center justify-center gap-2">
          <ArrowLeftRight className="w-4 h-4" /> Transfer
        </button>
      </div>
    </Sheet>
  );
}

function Tile({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-2xl glass p-3 flex flex-col items-start gap-1">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
