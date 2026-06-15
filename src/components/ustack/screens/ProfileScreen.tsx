import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Fingerprint, Bell, ShieldCheck, HelpCircle, Info, LogOut, Lock, Zap } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";

export function ProfileScreen({ onEdit, onSettings, onHelp, onLogout }: {
  onEdit: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onLogout: () => void;
}) {
  const { user, profile } = useAuth();
  const [biometrics, setBiometrics] = useState(false);

  const displayName = profile?.display_name ?? user?.username ?? "—";
  const initials = profile?.avatar_initials ?? user?.username?.slice(0, 2).toUpperCase() ?? "??";
  const avatarColor = profile?.avatar_color ?? "oklch(0.86 0.13 160)";
  const maskedEmail = maskEmail(user?.email ?? "");

  return (
    <div className="px-5 pt-2 pb-6 flex flex-col gap-5">

      {/* Profile header */}
      <div className="rounded-3xl glass-strong p-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-semibold text-white shrink-0"
          style={{ background: avatarColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold truncate">{displayName}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            @{user?.username ?? "—"} · {maskedEmail}
          </div>
        </div>
        <button onClick={onEdit} className="text-xs text-primary font-semibold px-3 py-1.5 rounded-full glass shrink-0">
          Edit
        </button>
      </div>

      {/* Price Protection — always active platform feature */}
      <div className="rounded-2xl border p-4 flex items-center justify-between" style={{ background: "oklch(0.15 0.02 160 / 0.6)", borderColor: "oklch(0.82 0.17 140 / 0.25)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.82 0.17 140 / 0.12)", border: "1px solid oklch(0.82 0.17 140 / 0.25)" }}>
            <ShieldCheck className="w-5 h-5" style={{ color: "oklch(0.82 0.17 140)" }} />
          </div>
          <div>
            <div className="text-sm font-semibold">Price Protection</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Auto-shields at 2% BTC drop</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0" style={{ background: "oklch(0.82 0.17 140 / 0.1)", borderColor: "oklch(0.82 0.17 140 / 0.3)" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "oklch(0.82 0.17 140)" }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.82 0.17 140)" }} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.82 0.17 140)" }}>Active</span>
        </div>
      </div>

      {/* Security */}
      <Section title="Security">
        <Row icon={Fingerprint} label="Biometrics" right={<Toggle on={biometrics} onChange={setBiometrics} />} />
        <Row icon={Lock} label="App PIN" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={onSettings} />
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <Row icon={Bell} label="Notifications" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={onSettings} />
        <Row icon={HelpCircle} label="Help & Support" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={onHelp} />
        <Row icon={Info} label="About UStack" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={onHelp} />
      </Section>

      {/* Log out */}
      <button
        onClick={onLogout}
        className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 flex items-center justify-center gap-2 text-sm text-destructive font-medium active:scale-[0.98] transition"
      >
        <LogOut className="w-4 h-4" /> Log out
      </button>
    </div>
  );
}

function maskEmail(email: string) {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local[0] ?? "";
  return `${visible}••• @${domain}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground px-1 mb-2">{title}</div>
      <div className="rounded-2xl glass overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, right, onClick }: { icon: typeof Bell; label: string; right?: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 text-left"
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="flex-1 text-sm">{label}</span>
      {right}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className={`w-12 h-7 rounded-full p-0.5 transition shrink-0 ${on ? "bg-primary" : "bg-white/10"}`}
    >
      <motion.div layout className={`w-6 h-6 rounded-full bg-white shadow ${on ? "ml-auto" : ""}`} />
    </button>
  );
}
