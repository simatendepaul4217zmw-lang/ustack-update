import { AnimatePresence, motion } from "framer-motion";
import { Plus, Vault, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";

export function Fab({ onCreateVault, onAddFunds, onWithdraw }: {
  onCreateVault: () => void;
  onAddFunds: () => void;
  onWithdraw: () => void;
}) {
  const [open, setOpen] = useState(false);

  const actions = [
    { label: "Create Vault", Icon: Vault,           color: "oklch(0.78 0.13 195)", onClick: onCreateVault },
    { label: "Add Funds",    Icon: ArrowDownToLine, color: "oklch(0.85 0.12 165)", onClick: onAddFunds },
    { label: "Withdraw",     Icon: ArrowUpFromLine, color: "oklch(0.72 0.18 25)",  onClick: onWithdraw },
  ];

  const radius = 110;
  const startDeg = -150;
  const endDeg = -30;
  const step = (endDeg - startDeg) / (actions.length - 1);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto relative">
        <AnimatePresence>
          {open && (
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 -z-10"
              style={{ background: "oklch(0.10 0.01 260 / 0.55)", backdropFilter: "blur(6px)" }}
            />
          )}
        </AnimatePresence>

        {actions.map((a, i) => {
          const angle = (startDeg + step * i) * (Math.PI / 180);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <AnimatePresence key={a.label}>
              {open && (
                <motion.button
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, x, y, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22, delay: i * 0.04 }}
                  onClick={() => { setOpen(false); a.onClick(); }}
                  className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full glass-strong"
                  style={{ boxShadow: "none" }}
                >
                  <a.Icon className="h-5 w-5" style={{ color: a.color }} />
                  <span className="absolute -bottom-6 whitespace-nowrap text-[10px] text-muted-foreground">
                    {a.label}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          );
        })}

        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.92 }}
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative grid h-16 w-16 place-items-center rounded-full bg-primary"
          aria-label={open ? "Close actions" : "Open actions"}
        >
          <Plus className="h-7 w-7 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
