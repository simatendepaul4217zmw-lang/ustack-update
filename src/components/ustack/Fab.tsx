import { AnimatePresence, motion } from "framer-motion";
import { Plus, Layers, Zap, ArrowLeftRight } from "lucide-react";
import { useState } from "react";

const actions = [
  {
    label: "New Vault",
    Icon: Layers,
    bg: "oklch(0.52 0.22 290)",
    shadow: "oklch(0.52 0.22 290 / 45%)",
  },
  {
    label: "Add Sats",
    Icon: Zap,
    bg: "oklch(0.58 0.20 148)",
    shadow: "oklch(0.58 0.20 148 / 45%)",
  },
  {
    label: "Transfer",
    Icon: ArrowLeftRight,
    bg: "oklch(0.65 0.21 38)",
    shadow: "oklch(0.65 0.21 38 / 45%)",
  },
] as const;

export function Fab({ onCreateVault, onAddFunds, onWithdraw }: {
  onCreateVault: () => void;
  onAddFunds: () => void;
  onWithdraw: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handlers = [onCreateVault, onAddFunds, onWithdraw];

  const radius = 112;
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
              style={{ background: "oklch(0.08 0.01 260 / 0.60)", backdropFilter: "blur(8px)" }}
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
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 1, x, y, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 340, damping: 24, delay: i * 0.05 }}
                  onClick={() => { setOpen(false); handlers[i](); }}
                  className="absolute left-1/2 top-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ background: a.bg, boxShadow: `0 6px 20px -4px ${a.shadow}` }}
                  aria-label={a.label}
                >
                  <a.Icon className="h-[22px] w-[22px] text-white" strokeWidth={2} />
                  <span
                    className="pointer-events-none absolute whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white/90"
                    style={{ bottom: "-22px", background: "oklch(0.12 0.01 260 / 0.70)", backdropFilter: "blur(4px)" }}
                  >
                    {a.label}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          );
        })}

        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.90 }}
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative grid h-16 w-16 place-items-center rounded-full bg-primary"
          style={{ boxShadow: "0 8px 24px -6px var(--primary)" }}
          aria-label={open ? "Close actions" : "Open actions"}
        >
          <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
        </motion.button>

      </div>
    </div>
  );
}
