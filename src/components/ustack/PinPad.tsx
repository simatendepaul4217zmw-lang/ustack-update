import { motion } from "framer-motion";
import { Delete, Fingerprint, CornerDownLeft } from "lucide-react";

interface PinPadProps {
  pin: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  onBiometric?: () => void;
  length?: number;
  error?: string;
  disabled?: boolean;
}

export function PinPad({ pin, onChange, onComplete, onBiometric, length = 4, error, disabled }: PinPadProps) {
  const handleKey = (k: number | "del") => {
    if (disabled) return;
    if (k === "del") {
      onChange(pin.slice(0, -1));
      return;
    }
    const next = pin + k;
    if (next.length > length) return;
    onChange(next);
    if (next.length === length) {
      setTimeout(() => onComplete?.(next), 120);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Dots */}
      <div className="flex gap-5">
        {Array.from({ length }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: pin.length === i + 1 ? [1, 1.4, 1] : 1,
              backgroundColor:
                i < pin.length
                  ? "oklch(0.82 0.17 140)"
                  : error
                  ? "oklch(0.55 0.2 25)"
                  : "oklch(0.28 0.01 260)",
            }}
            transition={{ duration: 0.16 }}
            className="w-4 h-4 rounded-full"
          />
        ))}
      </div>

      {/* Error */}
      <div className="h-4 -mt-2">
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-destructive text-center"
          >
            {error}
          </motion.p>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "del" as const, 0, "enter" as const].map((k, i) => (
          <button
            key={i}
            onClick={() => {
              if (k === "enter") { if (pin.length === length) onComplete?.(pin); }
              else handleKey(k as number | "del");
            }}
            disabled={disabled || (k === "enter" && pin.length < length)}
            className="h-14 rounded-2xl glass text-lg font-semibold flex items-center justify-center transition active:scale-90 active:bg-white/10 disabled:opacity-30"
          >
            {k === "del" ? <Delete className="w-5 h-5" /> : k === "enter" ? <CornerDownLeft className="w-5 h-5" /> : k}
          </button>
        ))}
      </div>

      {/* Fingerprint */}
      {onBiometric && (
        <button
          onClick={onBiometric}
          className="flex items-center gap-2 text-sm text-muted-foreground py-2.5 px-5 rounded-2xl glass active:scale-95 transition"
        >
          <Fingerprint className="w-4 h-4" style={{ color: "oklch(0.82 0.17 140)" }} />
          Use fingerprint instead
        </button>
      )}
    </div>
  );
}
