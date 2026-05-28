import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Plus, Vault, ArrowDownToLine, Send, ArrowUpFromLine } from "lucide-react";

export function Fab({
  onCreateVault,
  onAddFunds,
  onSend,
  onWithdraw,
}: {
  onCreateVault: () => void;
  onAddFunds: () => void;
  onSend: () => void;
  onWithdraw: () => void;
}) {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: Vault, label: "New Vault", angle: -148, onClick: onCreateVault, grad: "grad-coral", glow: "var(--shadow-glow-coral)" },
    { icon: ArrowDownToLine, label: "Add Funds", angle: -112, onClick: onAddFunds, grad: "grad-teal", glow: "var(--shadow-glow-teal)" },
    { icon: Send, label: "Send", angle: -68, onClick: onSend, grad: "grad-mint", glow: "var(--shadow-glow-teal)" },
    { icon: ArrowUpFromLine, label: "Withdraw", angle: -32, onClick: onWithdraw, grad: "grad-btc", glow: "var(--shadow-glow-coral)" },
  ];
  const R = 110;

  return (
    /* sits in the center notch of BottomNav: bottom-[52px] centers it in the nav top region */
    <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-background/50 backdrop-blur-sm pointer-events-auto"
            aria-label="Close actions"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center justify-center">
        {/* Arc action buttons */}
        {actions.map((a, i) => {
          const rad = (a.angle * Math.PI) / 180;
          const x = Math.cos(rad) * R;
          const y = Math.sin(rad) * R;
          const Icon = a.icon;
          return (
            <AnimatePresence key={a.label}>
              {open && (
                <motion.button
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                  animate={{ x, y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                  transition={{ type: "spring", stiffness: 350, damping: 24, delay: i * 0.045 }}
                  onClick={() => { a.onClick(); setOpen(false); }}
                  className="absolute pointer-events-auto"
                >
                  <div className="flex flex-col items-center gap-1.5 -translate-x-1/2 -translate-y-1/2">
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className={`w-12 h-12 rounded-2xl ${a.grad} flex items-center justify-center`}
                      style={{ boxShadow: a.glow }}
                    >
                      <Icon className="w-5 h-5 text-background" />
                    </motion.div>
                    <span className="text-[10px] font-semibold glass rounded-full px-2.5 py-0.5 whitespace-nowrap text-foreground">
                      {a.label}
                    </span>
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          );
        })}

        {/* Main FAB button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          animate={open ? { scale: 1.08 } : { scale: 1 }}
          onClick={() => setOpen(!open)}
          className="relative pointer-events-auto w-14 h-14 rounded-full grad-coral flex items-center justify-center"
          style={{
            boxShadow: open
              ? "0 0 0 6px color-mix(in oklab, var(--primary) 20%, transparent), var(--shadow-glow-coral)"
              : "var(--shadow-glow-coral)",
          }}
          aria-label="Quick actions"
        >
          <motion.div
            animate={{ rotate: open ? 135 : 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
          >
            <Plus className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
}
