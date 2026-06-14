import { motion } from "framer-motion";
import { Lock, TrendingUp } from "lucide-react";
import type { Vault } from "@/lib/ustack-data";
import { ProgressRing } from "./ProgressRing";
import { useCurrency } from "@/lib/currency-context";
import { useBtcPrice } from "@/lib/hooks/useAppData";
import { ACCENT_COLORS, VaultIcon } from "@/lib/vault-theme";

export function VaultCard({ vault, onClick, large = false }: { vault: Vault; onClick?: () => void; large?: boolean }) {
  const { fmtValue } = useCurrency();
  const { data: btcPrice } = useBtcPrice();
  const priceZmw = btcPrice?.priceZmw;
  const pct = vault.currentSats / vault.goalSats;
  const accent = ACCENT_COLORS[vault.accent] ?? ACCENT_COLORS.btc;
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative w-full text-left rounded-3xl p-4 glass-strong overflow-hidden shadow-soft ${large ? "h-44" : "h-48"}`}
    >
      <div className="relative flex justify-between items-start">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            {vault.type === "hodl" ? <Lock className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {vault.type === "hodl" ? "Hodl Vault" : "Stack Vault"}
          </div>
          <div className="text-base font-semibold mt-1 leading-tight">{vault.name}</div>
        </div>
        <ProgressRing value={pct} size={52} accent={vault.accent}>
          <span className="text-[10px] font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
        </ProgressRing>
      </div>

      <div className="relative mt-auto pt-5 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{ color: accent }}>
            <VaultIcon name={vault.emoji} className="w-3.5 h-3.5" />
          </div>
          <div className="text-[10px] text-muted-foreground">Saved</div>
          <div className="text-sm font-semibold tabular-nums">{fmtValue(vault.currentSats, priceZmw)}</div>
          <div className="text-[10px] text-muted-foreground/60 tabular-nums">{(vault.currentSats / 1000).toFixed(0)}k sats</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">
            {vault.type === "hodl" ? `${vault.daysRemaining}d left` : `${vault.streakDays}d streak`}
          </div>
          <div className="text-xs font-medium">
            {vault.type === "hodl" ? "Time-locked" : "Flexible"}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 1 }} className="h-full" style={{ background: accent }} />
      </div>
    </motion.button>
  );
}
