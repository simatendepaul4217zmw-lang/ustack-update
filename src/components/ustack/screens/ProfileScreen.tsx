import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Fingerprint, Bell, ShieldCheck, HelpCircle, Info, LogOut, Lock } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import { usePriceProtection, useUpdatePriceProtection } from "@/lib/hooks/useAppData";

export function ProfileScreen({ onEdit, onSettings, onHelp, onLogout }: {
  onEdit: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onLogout: () => void;
}) {
  const { user, profile } = useAuth();
  const { data: ppData } = usePriceProtection();
  const updatePp = useUpdatePriceProtection();

  const [protection, setProtection] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [threshold, setThreshold] = useState(5);

  useEffect(() => {
    if (ppData) {
      setProtection(ppData.enabled);
      const validOptions = [5, 10, 20];
      setThreshold(validOptions.includes(ppData.threshold_pct) ? ppData.threshold_pct : 5);
    }
  }, [ppData]);

  const handleProtectionToggle = (v: boolean) => {
    setProtection(v);
    updatePp.mutate({ enabled: v, thresholdPct: threshold });
  };

  const handleThreshold = (v: number) => {
    setThreshold(v);
    updatePp.mutate({ enabled: protection, thresholdPct: v });
  };

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

      {/* Price Protection card */}
      <div className="rounded-3xl bg-card border border-white/8 p-5">
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Price Protection</div>
            <div className="text-lg font-semibold mt-1">Auto-shield your stack</div>
          </div>
          <Toggle on={protection} onChange={handleProtectionToggle} />
        </div>
        <div className="relative mt-4 text-sm text-muted-foreground">
          Protect if Bitcoin drops by <span className="text-foreground font-semibold">{threshold}%</span>.
        </div>
        <div className="relative mt-3 flex gap-2">
          {[5, 10, 20].map((v) => (
            <button
              key={v}
              onClick={() => handleThreshold(v)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${threshold === v ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              {v}%
            </button>
          ))}
        </div>
        <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" />
          {protection ? "Protection active" : "Protection disabled"}
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
