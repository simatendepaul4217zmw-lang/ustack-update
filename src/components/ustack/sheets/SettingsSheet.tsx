import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Bell, Trash2, ChevronRight, Sun, Moon, Loader2, ShieldCheck, ShieldOff, ShieldAlert, ArrowLeft } from "lucide-react";
import { Sheet } from "./Sheet";
import { useTheme } from "@/lib/theme-context";
import { useCurrency, type Currency } from "@/lib/currency-context";
import { useSecurityStatus, useSetBiometric } from "@/lib/hooks/useAppData";
import { isBiometricAvailable, clearWebBiometric } from "@/lib/native";

type Section = "main" | "notifications";

const LS = {
  get: (k: string, fallback: string) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

const NOTIF_KEYS = {
  deposit: "ustack_notif_deposit",
  milestone: "ustack_notif_milestone",
  streak: "ustack_notif_streak",
  protection: "ustack_notif_protection",
  weekly: "ustack_notif_weekly",
};

export function SettingsSheet({
  open,
  onClose,
  onOpenSecurity,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSecurity?: (startAt?: "pin" | "biometric") => void;
}) {
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<Section>("main");
  const [clearing, setClearing] = useState(false);
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);

  const [notifDeposit, setNotifDeposit] = useState(() => LS.get(NOTIF_KEYS.deposit, "true") === "true");
  const [notifMilestone, setNotifMilestone] = useState(() => LS.get(NOTIF_KEYS.milestone, "true") === "true");
  const [notifStreak, setNotifStreak] = useState(() => LS.get(NOTIF_KEYS.streak, "true") === "true");
  const [notifProtection, setNotifProtection] = useState(() => LS.get(NOTIF_KEYS.protection, "true") === "true");
  const [notifWeekly, setNotifWeekly] = useState(() => LS.get(NOTIF_KEYS.weekly, "false") === "true");
  const { currency, setCurrency: setGlobalCurrency } = useCurrency();

  const { data: security, isLoading: secLoading } = useSecurityStatus();
  const setBiometric = useSetBiometric();

  useEffect(() => { if (!open) setSection("main"); }, [open]);

  // Check biometric availability when sheet opens
  useEffect(() => {
    if (!open) return;
    isBiometricAvailable().then(setBioAvailable);
  }, [open]);

  const handleBiometricsChange = async (v: boolean) => {
    if (v) {
      if (!security?.pinEnabled) {
        onOpenSecurity?.("pin");
      } else {
        onOpenSecurity?.("biometric");
      }
      return;
    }
    // Disabling — also clear the web biometric credential
    try {
      await setBiometric.mutateAsync({ enabled: false });
      clearWebBiometric();
    } catch {}
  };

  const notifChange = (key: keyof typeof NOTIF_KEYS, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v); LS.set(NOTIF_KEYS[key], String(v));
  };

  const clearCache = async () => {
    setClearing(true);
    const keep = ["ustack-theme", "ustack_token", ...Object.values(NOTIF_KEYS)];
    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !keep.includes(k)) allKeys.push(k);
      }
      allKeys.forEach((k) => localStorage.removeItem(k));
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
    setClearing(false);
    window.location.reload();
  };

  const close = () => { setSection("main"); onClose(); };

  const SecIcon = !security?.pinEnabled ? ShieldOff : ShieldCheck;
  const secLabel = !security?.pinEnabled
    ? "Not configured"
    : security.biometricEnabled
    ? "PIN + Fingerprint"
    : "PIN protected";
  const secColor = security?.pinEnabled ? "text-primary" : "text-muted-foreground";

  return (
    <Sheet open={open} onClose={close} title={section === "main" ? "Settings" : "Notifications"}>
      {section !== "main" && (
        <button onClick={() => setSection("main")} className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 -mt-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      )}

      {section === "main" && (
        <div className="flex flex-col gap-5">

          <Group title="Security">
            {!secLoading && (
              <div className="px-4 py-3 flex items-center gap-3 border-b border-white/5">
                <SecIcon className={`w-4 h-4 shrink-0 ${secColor}`} />
                <span className={`text-sm flex-1 ${secColor}`}>{secLabel}</span>
                {security?.locked && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Locked</span>
                )}
              </div>
            )}
            <Row
              icon={ShieldAlert}
              label={security?.pinEnabled ? "Change PIN" : "Set up PIN"}
              right={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
              onClick={() => onOpenSecurity?.("pin")}
            />

            {/* Fingerprint row — only show if PIN is set and biometric is available on this device */}
            {security?.pinEnabled && (
              bioAvailable === null ? (
                <div className="px-4 py-3.5 flex items-center gap-3 border-b border-white/5 last:border-0">
                  <Fingerprint className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm text-muted-foreground">Fingerprint unlock</span>
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : bioAvailable ? (
                <Row
                  icon={Fingerprint}
                  label="Fingerprint unlock"
                  right={
                    setBiometric.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      : <Toggle on={security?.biometricEnabled ?? false} onChange={handleBiometricsChange} />
                  }
                />
              ) : (
                <div className="px-4 py-3.5 flex items-center gap-3 border-b border-white/5 last:border-0 opacity-50">
                  <Fingerprint className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm text-muted-foreground">Fingerprint unlock</span>
                  <span className="text-[10px] text-muted-foreground">Not supported</span>
                </div>
              )
            )}

            {/* If no PIN yet, prompt to set one first */}
            {!security?.pinEnabled && !secLoading && (
              <div className="px-4 py-3.5 flex items-center gap-3 last:border-0 opacity-40">
                <Fingerprint className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm text-muted-foreground">Fingerprint unlock</span>
                <span className="text-[10px] text-muted-foreground">Set PIN first</span>
              </div>
            )}
          </Group>

          <Group title="Notifications">
            <Row icon={Bell} label="Notification preferences" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={() => setSection("notifications")} />
          </Group>

          <Group title="Display">
            <Row
              icon={theme === "dark" ? Moon : Sun}
              label="Theme"
              right={
                <div className="flex gap-0.5 p-1 rounded-xl glass">
                  <button onClick={() => setTheme("light")} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    <Sun className="w-3 h-3" /> Light
                  </button>
                  <button onClick={() => setTheme("dark")} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    <Moon className="w-3 h-3" /> Dark
                  </button>
                </div>
              }
            />
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground mb-2">Display currency</div>
              <div className="flex gap-2">
                {(["ZMW", "USD", "BTC"] as Currency[]).map((c) => (
                  <button key={c} onClick={() => setGlobalCurrency(c)} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${currency === c ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Group>

          <Group title="Data">
            <button onClick={clearCache} disabled={clearing} className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-white/5 last:border-0">
              {clearing ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" /> : <Trash2 className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="flex-1 text-sm">{clearing ? "Clearing…" : "Clear app cache"}</span>
              <span className="text-xs text-muted-foreground">Reloads app</span>
            </button>
          </Group>

          <p className="text-center text-xs text-muted-foreground mt-2">ustack v1.0.0 · built for zambia</p>
        </div>
      )}

      {section === "notifications" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground mb-2">Choose what you want to be notified about.</p>
          <Group title="Transactions">
            <Row icon={Bell} label="Deposits confirmed" right={<Toggle on={notifDeposit} onChange={notifChange("deposit", setNotifDeposit)} />} />
          </Group>
          <Group title="Progress">
            <Row icon={Bell} label="Vault milestones" right={<Toggle on={notifMilestone} onChange={notifChange("milestone", setNotifMilestone)} />} />
            <Row icon={Bell} label="Streak reminders" right={<Toggle on={notifStreak} onChange={notifChange("streak", setNotifStreak)} />} />
            <Row icon={Bell} label="Price protection" right={<Toggle on={notifProtection} onChange={notifChange("protection", setNotifProtection)} />} />
          </Group>
          <Group title="Summary">
            <Row icon={Bell} label="Weekly summary" right={<Toggle on={notifWeekly} onChange={notifChange("weekly", setNotifWeekly)} />} />
          </Group>
        </div>
      )}
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground px-1 mb-2">{title}</div>
      <div className="rounded-2xl glass overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, right, onClick }: { icon: React.ElementType; label: string; right?: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 text-left">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm">{label}</span>
      {right}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!on); }} className={`w-12 h-7 rounded-full p-0.5 transition shrink-0 ${on ? "bg-primary" : "bg-white/10"}`}>
      <motion.div layout className={`w-6 h-6 rounded-full bg-white shadow ${on ? "ml-auto" : ""}`} />
    </button>
  );
}
