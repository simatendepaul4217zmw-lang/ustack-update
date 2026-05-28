import { motion } from "framer-motion";

const accentMap = {
  coral: "oklch(0.74 0.18 25)",
  teal: "oklch(0.78 0.14 190)",
  mint: "oklch(0.86 0.13 160)",
  aqua: "oklch(0.78 0.12 220)",
  btc: "oklch(0.74 0.18 55)",
} as const;

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  accent = "coral",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  accent?: keyof typeof accentMap;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(value, 0), 1));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={accentMap[accent]}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
