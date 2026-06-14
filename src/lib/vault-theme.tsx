import {
  Target, Shield, Star, Home, GraduationCap, Laptop, Heart, Globe,
  Briefcase, Zap, Diamond, Rocket, Gift, Flame, Camera, Music,
  Car, Leaf, Trophy, Building, Plane, ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ACCENT_COLORS: Record<string, string> = {
  btc:    "oklch(0.74 0.18 55)",
  purple: "oklch(0.68 0.22 300)",
  teal:   "oklch(0.78 0.14 170)",
  blue:   "oklch(0.72 0.16 250)",
  rose:   "oklch(0.68 0.22 10)",
  gold:   "oklch(0.82 0.16 85)",
};

export const VAULT_ACCENTS: { value: string; label: string }[] = [
  { value: "btc",    label: "Orange" },
  { value: "purple", label: "Purple" },
  { value: "teal",   label: "Teal"   },
  { value: "blue",   label: "Blue"   },
  { value: "rose",   label: "Rose"   },
  { value: "gold",   label: "Gold"   },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Target, Shield, Star, Home, GraduationCap, Laptop, Heart, Globe,
  Briefcase, Zap, Diamond, Rocket, Gift, Flame, Camera, Music,
  Car, Leaf, Trophy, Building, Plane, ShieldCheck,
};

export const VAULT_ICONS = Object.keys(ICON_MAP);

export function VaultIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Target;
  return <Icon className={className} />;
}
