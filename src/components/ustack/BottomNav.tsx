import { Home, Layers, Activity, User } from "lucide-react";
import { motion } from "framer-motion";

export type Tab = "home" | "vaults" | "activity" | "profile";

const left:  { id: Tab; Icon: typeof Home; label: string }[] = [
  { id: "home",   Icon: Home,   label: "Home" },
  { id: "vaults", Icon: Layers, label: "Vaults" },
];
const right: { id: Tab; Icon: typeof Home; label: string }[] = [
  { id: "activity", Icon: Activity, label: "Activity" },
  { id: "profile",  Icon: User,     label: "Profile" },
];

function NavBtn({ id, Icon, label, active, onClick }: { id: Tab; Icon: typeof Home; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-1 flex-col items-center justify-center rounded-full px-3 py-2 text-[10px] font-medium"
    >
      {active && (
        <motion.span
          layoutId="navPill"
          className="absolute inset-0 rounded-full"
          style={{ background: "oklch(1 0 0 / 0.13)" }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon
        className="relative h-5 w-5"
        style={{ color: active ? "oklch(0.82 0.17 140)" : "oklch(0.55 0.012 255)" }}
      />
      <span
        className="relative mt-0.5 font-semibold"
        style={{ color: active ? "oklch(1 0 0)" : "oklch(0.52 0.012 255)" }}
      >
        {label}
      </span>
    </button>
  );
}

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)]">
      <div
        className="glass-strong relative flex items-center rounded-full px-2 py-2"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
        {/* Left side */}
        <div className="flex flex-1 items-center">
          {left.map(({ id, Icon, label }) => (
            <NavBtn key={id} id={id} Icon={Icon} label={label} active={tab === id} onClick={() => onChange(id)} />
          ))}
        </div>

        {/* Centre gap for FAB — wide enough so neither side touches the button */}
        <div className="w-20 shrink-0" aria-hidden />

        {/* Right side */}
        <div className="flex flex-1 items-center">
          {right.map(({ id, Icon, label }) => (
            <NavBtn key={id} id={id} Icon={Icon} label={label} active={tab === id} onClick={() => onChange(id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
