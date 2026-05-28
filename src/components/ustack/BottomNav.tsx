import { Home, Wallet, Activity, User } from "lucide-react";
import { motion } from "framer-motion";

export type Tab = "home" | "vaults" | "activity" | "profile";

const items: { id: Tab; icon: typeof Home; label: string }[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "vaults", icon: Wallet, label: "Vaults" },
  { id: "activity", icon: Activity, label: "Activity" },
  { id: "profile", icon: User, label: "Profile" },
];

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof items)[0];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 py-1 px-4 group"
    >
      <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200">
        {active && (
          <motion.div
            layoutId="nav-bg"
            className="absolute inset-0 rounded-2xl"
            style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon
          className={`relative w-5 h-5 transition-colors duration-200 ${
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          }`}
          strokeWidth={active ? 2.2 : 1.8}
        />
        {active && (
          <motion.span
            layoutId="nav-dot"
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
      </div>
      <span
        className={`text-[10px] font-medium transition-colors duration-200 ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {item.label}
      </span>
    </button>
  );
}

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      {/* top highlight line */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div
        className="glass-strong flex items-center pb-5 pt-2"
        style={{ boxShadow: "0 -1px 0 0 color-mix(in oklab, white 6%, transparent)" }}
      >
        {/* Left nav items */}
        <div className="flex-1 flex items-center justify-around">
          {leftItems.map((it) => (
            <NavItem key={it.id} item={it} active={it.id === tab} onClick={() => onChange(it.id)} />
          ))}
        </div>

        {/* Center notch — FAB sits here */}
        <div className="w-20 flex-shrink-0" />

        {/* Right nav items */}
        <div className="flex-1 flex items-center justify-around">
          {rightItems.map((it) => (
            <NavItem key={it.id} item={it} active={it.id === tab} onClick={() => onChange(it.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
