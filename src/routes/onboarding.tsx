import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Lock, TrendingUp, Shield } from "lucide-react";
import { PhoneFrame } from "@/components/ustack/PhoneFrame";
import { ACCENT_COLORS } from "@/lib/vault-theme";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Get Started - UStack" }, { name: "description", content: "Learn how Hodl and Stack vaults work." }] }),
  component: Onboarding,
});

const slides = [
  {
    icon: Lock,
    accent: "rose" as const,
    title: "Hodl Vaults lock Bitcoin long-term.",
    sub: "Commit your sats. Stay focused. Let time do the work.",
    art: "vault",
  },
  {
    icon: TrendingUp,
    accent: "teal" as const,
    title: "Stack Vaults grow step by step.",
    sub: "Small, recurring deposits compound into something real.",
    art: "stack",
  },
  {
    icon: Shield,
    accent: "purple" as const,
    title: "Early withdrawals include penalties.",
    sub: "A gentle nudge to keep you on track, not punishment.",
    art: "shield",
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const next = () => (i < slides.length - 1 ? setI(i + 1) : nav({ to: "/signup" }));
  const s = slides[i];

  return (
    <PhoneFrame>
      <div className="h-full flex flex-col px-7 pt-12 pb-10 bg-background relative overflow-hidden">
        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">{i + 1} / {slides.length}</div>
          <Link to="/signup" className="text-sm text-muted-foreground">Skip</Link>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center"
            >
              <IllustrationArt kind={s.art} accent={s.accent} />
              <h2 className="mt-10 text-2xl font-semibold tracking-tight max-w-[18rem]">{s.title}</h2>
              <p className="mt-3 text-muted-foreground max-w-[20rem]">{s.sub}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-6 items-center">
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <motion.div
                key={idx}
                animate={{ width: idx === i ? 24 : 6, opacity: idx === i ? 1 : 0.4 }}
                className="h-1.5 rounded-full bg-foreground"
              />
            ))}
          </div>
          <button
            onClick={next}
            className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition"
          >
            {i < slides.length - 1 ? "Next" : "Create my account"}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

function IllustrationArt({ kind, accent }: { kind: string; accent: string }) {
  const color = ACCENT_COLORS[accent] ?? ACCENT_COLORS.btc;
  return (
    <div className="relative w-56 h-56">
      <div className="relative w-full h-full glass-strong rounded-[2.5rem] flex items-center justify-center">
        {kind === "vault" && (
          <svg viewBox="0 0 120 120" className="w-32 h-32">
            <rect x="20" y="28" width="80" height="72" rx="14" fill={color} />
            <circle cx="60" cy="64" r="18" stroke="white" strokeWidth="3" fill="none" />
            <circle cx="60" cy="64" r="4" fill="white" />
            <line x1="60" y1="48" x2="60" y2="44" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {kind === "stack" && (
          <svg viewBox="0 0 120 120" className="w-32 h-32">
            {[0,1,2,3].map(j => (
              <motion.rect
                key={j}
                x={28} y={88 - j*16} width={64} height={12} rx={6}
                fill={color}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1 - j*0.18, y: 0 }}
                transition={{ delay: 0.1 + j*0.12 }}
              />
            ))}
          </svg>
        )}
        {kind === "shield" && (
          <svg viewBox="0 0 120 120" className="w-32 h-32">
            <path d="M60 20 L92 32 V62 C92 82 78 96 60 102 C42 96 28 82 28 62 V32 Z" fill={color} />
            <path d="M48 62 L57 71 L74 54" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
