import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownToLine, Trophy, Flame, ShieldCheck, ArrowUpFromLine, Vault, Loader2, ChevronDown } from "lucide-react";
import { useActivity } from "@/lib/hooks/useAppData";

const iconMap: Record<string, typeof Flame> = {
  deposit: ArrowDownToLine, milestone: Trophy, streak: Flame,
  protection: ShieldCheck, withdraw: ArrowUpFromLine, vault: Vault,
  vault_deposit: ArrowDownToLine, vault_withdraw: ArrowUpFromLine, vault_created: Vault,
  login: ShieldCheck,
};
const colorMap: Record<string, string> = {
  deposit: "oklch(0.73 0.19 55)", milestone: "oklch(0.86 0.13 160)", streak: "oklch(0.74 0.18 55)",
  protection: "oklch(0.82 0.17 140)", withdraw: "oklch(0.82 0.17 140)", vault: "oklch(0.73 0.19 55)",
  vault_deposit: "oklch(0.73 0.19 55)", vault_withdraw: "oklch(0.82 0.17 140)",
  vault_created: "oklch(0.86 0.13 160)", login: "oklch(0.82 0.17 140)",
};

const kindLabel: Record<string, string> = {
  deposit: "Deposit", milestone: "Milestone", streak: "Streak", protection: "Protection",
  withdraw: "Withdrawal", vault: "Vault", vault_deposit: "Vault Deposit",
  vault_withdraw: "Vault Withdrawal", vault_created: "Vault Created", login: "Login",
};

type FilterKind = "all" | "deposit" | "withdraw" | "vault" | "events";

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "deposit",  label: "Add Sats" },
  { id: "withdraw", label: "Transfers" },
  { id: "vault",    label: "Vaults" },
  { id: "events",   label: "Events" },
];

export function ActivityScreen() {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: activity = [], isLoading } = useActivity();

  const filtered = activity.filter((a) => {
    if (filter === "all") return true;
    if (filter === "events") return ["milestone", "streak", "protection", "login"].includes(a.kind);
    if (filter === "vault") return ["vault", "vault_created", "vault_deposit", "vault_withdraw"].includes(a.kind);
    if (filter === "deposit") return ["deposit", "vault_deposit"].includes(a.kind);
    if (filter === "withdraw") return ["withdraw", "vault_withdraw"].includes(a.kind);
    return a.kind === filter;
  });

  return (
    <div className="px-5 pt-2 flex flex-col gap-5">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Activity</div>
        <div className="text-sm text-muted-foreground">Every step you took toward your goals.</div>
      </div>

      {/* Filter chips */}
      <div className="-mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f.id ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-12">
          {filter === "all" ? "No activity yet. Make your first deposit!" : `No ${filter} activity yet.`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {filtered.map((a, i) => {
              const Icon = iconMap[a.kind] ?? Flame;
              const color = colorMap[a.kind] ?? "oklch(0.73 0.19 55)";
              const isOpen = expanded === a.id;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-card/60 overflow-hidden"
                >
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left"
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.meta}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{a.when}</span>
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0 border-t border-white/5 mt-0">
                          <div className="pt-3 flex flex-col gap-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Type</span>
                              <span className="font-medium">{kindLabel[a.kind] ?? a.kind}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Details</span>
                              <span className="font-medium text-right max-w-[60%]">{a.meta}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">When</span>
                              <span className="font-medium">{a.when}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
