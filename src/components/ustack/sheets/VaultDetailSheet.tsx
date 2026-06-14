import { Lock, TrendingUp, Calendar, Flame, Zap, ArrowLeftRight, Trophy, Check } from "lucide-react";
import { Sheet } from "./Sheet";
import { ProgressRing } from "../ProgressRing";
import type { Vault } from "@/lib/ustack-data";
import { useBtcPrice } from "@/lib/hooks/useAppData";
import { useCurrency } from "@/lib/currency-context";

const accentMap = { coral: "oklch(0.73 0.19 55)", teal: "oklch(0.78 0.14 190)", mint: "oklch(0.86 0.13 160)", aqua: "oklch(0.78 0.14 190)", btc: "oklch(0.74 0.18 55)" } as const;

export function VaultDetailSheet({ open, vault, onClose, onDeposit, onWithdraw }: {
  open: boolean; vault: Vault | null; onClose: () => void; onDeposit: () => void; onWithdraw: () => void;
}) {
  const { data: btcPrice } = useBtcPrice();
  const priceZmw = btcPrice?.priceZmw;
  const { fmtValue } = useCurrency();

  if (!vault) return <Sheet open={open} onClose={onClose}><div /></Sheet>;
  const pct = vault.currentSats / vault.goalSats;
  return (
    <Sheet open={open} onClose={onClose} title={vault.name}>
      <div className="relative rounded-3xl p-6 bg-card overflow-hidden shadow-soft border border-white/5">
        <div className="flex items-center gap-5">
          <ProgressRing value={pct} size={112} stroke={10} accent={vault.accent}>
            <div className="text-center">
              <div className="text-2xl font-semibold tabular-nums">{Math.round(pct * 100)}%</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">complete</div>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              {vault.type === "hodl" ? <Lock className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {vault.type === "hodl" ? "Hodl Vault" : "Stack Vault"}
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{fmtValue(vault.currentSats, priceZmw)}</div>
            <div className="text-xs text-muted-foreground">{vault.currentSats.toLocaleString()} sats</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">of {fmtValue(vault.goalSats, priceZmw)} goal</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile icon={Calendar} label="Days left" value={`${vault.daysRemaining}`} />
        <Tile icon={Flame} label="Streak" value={`${vault.streakDays}d`} />
        <Tile icon={Trophy} label="Milestones" value={`${Math.floor(pct * 4)}/4`} />
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Milestones</div>
        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1].map((m, i) => {
            const hit = pct >= m;
            return (
              <div key={i} className={`flex-1 rounded-xl p-3 text-center border ${hit ? "bg-card border-primary/30" : "bg-card/40 border-transparent"}`}>
                <div className="text-xs font-semibold">{m * 100}%</div>
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

      <div className="mt-8 flex gap-3">
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
