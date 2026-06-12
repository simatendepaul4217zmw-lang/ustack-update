import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Bell, Trash2, ChevronRight, Check, ArrowLeft, Sun, Moon, Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { useTheme } from "@/lib/theme-context";
import { useCurrency, type Currency } from "@/lib/currency-context";

type Section = "main" | "pin" | "notifications";

const LS = {
  get: (k: string, fallback: string) => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  remove: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};

const PIN_KEY = "ustack_pin";
const NOTIF_KEYS = {
  deposit: "ustack_notif_deposit",
  milestone: "ustack_notif_milestone",
  streak: "ustack_notif_streak",
  protection: "ustack_notif_protection",
  weekly: "ustack_notif_weekly",
};
const BIOMETRICS_KEY = "ustack_biometrics";
const CURRENCY_KEY = "ustack_currency";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<Section>("main");

  const [biometrics, setBiometrics] = useState(() => LS.get(BIOMETRICS_KEY, "true") === "true");
  const [notifDeposit, setNotifDeposit] = useState(() => LS.get(NOTIF_KEYS.deposit, "true") === "true");
  const [notifMilestone, setNotifMilestone] = useState(() => LS.get(NOTIF_KEYS.milestone, "true") === "true");
  const [notifStreak, setNotifStreak] = useState(() => LS.get(NOTIF_KEYS.streak, "true") === "true");
  const [notifProtection, setNotifProtection] = useState(() => LS.get(NOTIF_KEYS.protection, "true") === "true");
  const [notifWeekly, setNotifWeekly] = useState(() => LS.get(NOTIF_KEYS.weekly, "false") === "true");
  const { currency, setCurrency: setGlobalCurrency } = useCurrency();

  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm" | "done">("current");
  const [pinEntry, setPinEntry] = useState("");
  const [newPinEntry, setNewPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [clearing, setClearing] = useState(false);

  const hasPin = LS.get(PIN_KEY, "") !== "";

  useEffect(() => {
    if (open) {
      setPinStep(hasPin ? "current" : "new");
      setPinEntry(""); setNewPinEntry(""); setPinError("");
    }
  }, [open]);

  const handleBiometricsChange = (v: boolean) => { setBiometrics(v); LS.set(BIOMETRICS_KEY, String(v)); };
  const handleCurrencyChange = (c: Currency) => { setGlobalCurrency(c); };

  const notifChange = (key: keyof typeof NOTIF_KEYS, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v); LS.set(NOTIF_KEYS[key], String(v));
  };

  const clearCache = async () => {
    setClearing(true);
    const keep = ["ustack-theme", "ustack_token", "ustack_pin", BIOMETRICS_KEY, CURRENCY_KEY, ...Object.values(NOTIF_KEYS)];
    const allKeys: string[] = [];
    try {
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

  const close = () => {
    setSection("main");
    setPinStep(hasPin ? "current" : "new");
    setPinEntry(""); setNewPinEntry(""); setPinError("");
    onClose();
  };
  const back = () => {
    setSection("main");
    setPinStep(hasPin ? "current" : "new");
    setPinEntry(""); setNewPinEntry(""); setPinError("");
  };

  const handlePinDigit = (k: number | string) => {
    if (k === "⌫") { setPinEntry((p) => p.slice(0, -1)); return; }
    if (k === "") return;
    const next = pinEntry + k;
    if (next.length > 6) return;
    setPinEntry(next);

    if (next.length === 6) {
      setTimeout(() => {
        if (pinStep === "current") {
          if (next !== LS.get(PIN_KEY, "")) {
            setPinError("Incorrect PIN"); setPinEntry(""); return;
          }
          setPinError(""); setPinEntry(""); setPinStep("new");
        } else if (pinStep === "new") {
          setNewPinEntry(next); setPinEntry(""); setPinStep("confirm");
        } else if (pinStep === "confirm") {
          if (next !== newPinEntry) {
            setPinError("PINs don't match"); setPinEntry(""); setPinStep("new"); setNewPinEntry(""); return;
          }
          LS.set(PIN_KEY, next);
          setPinStep("done"); setPinEntry("");
        }
      }, 280);
    }
  };

  const pinLabels: Record<string, string> = {
    current: "Enter current PIN",
    new: hasPin ? "Enter new PIN" : "Create a 6-digit PIN",
    confirm: "Confirm new PIN",
  };

  return (
    <Sheet open={open} onClose={close} title={section === "main" ? "Settings" : section === "pin" ? "Change PIN" : "Notifications"}>
      {section !== "main" && (
        <button onClick={back} className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 -mt-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      )}

      {section === "main" && (
        <div className="flex flex-col gap-5">
          <Group title="Security">
            <Row icon={Fingerprint} label="Biometrics" right={<Toggle on={biometrics} onChange={handleBiometricsChange} />} />
            <Row icon={Fingerprint} label={hasPin ? "Change PIN" : "Set up PIN"} right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={() => { setPinStep(hasPin ? "current" : "new"); setSection("pin"); }} />
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
                {["ZMW", "USD", "BTC"].map((c) => (
                  <button key={c} onClick={() => handleCurrencyChange(c)} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${currency === c ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Group>

          <Group title="Data">
            <button
              onClick={clearCache}
              disabled={clearing}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-white/5 last:border-0"
            >
              {clearing ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" /> : <Trash2 className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="flex-1 text-sm">{clearing ? "Clearing…" : "Clear app cache"}</span>
              <span className="text-xs text-muted-foreground">Reloads app</span>
            </button>
          </Group>

          <p className="text-center text-xs text-muted-foreground mt-2">ustack v1.0.0 · built for zambia</p>
        </div>
      )}

      {section === "pin" && (
        <div className="flex flex-col items-center">
          {pinStep !== "done" ? (
            <>
              <p className="text-sm text-muted-foreground mb-8 text-center">{pinLabels[pinStep]}</p>
              <div className="flex gap-4 mb-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: pinEntry.length === i + 1 ? [1, 1.3, 1] : 1, background: i < pinEntry.length ? "oklch(0.73 0.19 55)" : "oklch(0.3 0.01 260)" }}
                    transition={{ duration: 0.18 }}
                    className="w-4 h-4 rounded-full"
                  />
                ))}
              </div>
              {pinError && <p className="text-xs text-destructive mb-4">{pinError}</p>}
              {!pinError && <div className="mb-7" />}
              <div className="grid grid-cols-3 gap-3 w-full px-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
                  <button
                    key={i}
                    disabled={k === ""}
                    onClick={() => handlePinDigit(k)}
                    className={`h-14 rounded-2xl text-lg font-semibold flex items-center justify-center transition active:scale-95 ${k === "" ? "invisible" : "glass"}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 flex flex-col items-center gap-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.86 0.13 160)" }}>
                <Check className="w-10 h-10" strokeWidth={3} />
              </motion.div>
              <div className="text-lg font-semibold">PIN {hasPin ? "updated" : "created"}</div>
              <p className="text-sm text-muted-foreground text-center">Your PIN is saved on this device.</p>
              <button onClick={close} className="mt-4 w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl">Done</button>
            </div>
          )}
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

function Row({ icon: Icon, label, right, onClick }: { icon: typeof Bell; label: string; right?: React.ReactNode; onClick?: () => void }) {
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
