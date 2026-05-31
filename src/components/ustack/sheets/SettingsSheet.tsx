import { useState } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Bell, DollarSign, Trash2, ChevronRight, Check, ArrowLeft } from "lucide-react";
import { Sheet } from "./Sheet";

type Section = "main" | "pin" | "notifications";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState<Section>("main");
  const [biometrics, setBiometrics] = useState(true);
  const [notifDeposit, setNotifDeposit] = useState(true);
  const [notifMilestone, setNotifMilestone] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);
  const [notifProtection, setNotifProtection] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const [currency, setCurrency] = useState("ZMW");
  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm" | "done">("current");
  const [pinEntry, setPinEntry] = useState("");

  const close = () => { setSection("main"); setPinStep("current"); setPinEntry(""); onClose(); };
  const back = () => { setSection("main"); setPinStep("current"); setPinEntry(""); };

  const pinLabels = { current: "Enter current PIN", new: "Enter new PIN", confirm: "Confirm new PIN", done: "" };

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
            <Row icon={Fingerprint} label="Biometrics" right={<Toggle on={biometrics} onChange={setBiometrics} />} />
            <Row icon={Fingerprint} label="Change PIN" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={() => setSection("pin")} />
          </Group>

          <Group title="Notifications">
            <Row icon={Bell} label="Notification preferences" right={<ChevronRight className="w-4 h-4 text-muted-foreground" />} onClick={() => setSection("notifications")} />
          </Group>

          <Group title="Display">
            <div className="px-4 py-3">
              <div className="text-xs text-muted-foreground mb-2">Display currency</div>
              <div className="flex gap-2">
                {["ZMW", "USD", "BTC"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${currency === c ? "grad-coral text-background" : "glass text-muted-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Group>

          <Group title="Data">
            <Row icon={Trash2} label="Clear app cache" right={<span className="text-xs text-muted-foreground">48 MB</span>} />
          </Group>

          <p className="text-center text-xs text-muted-foreground mt-2">ustack v1.0.0 · built for zambia</p>
        </div>
      )}

      {section === "pin" && (
        <div className="flex flex-col items-center">
          {pinStep !== "done" ? (
            <>
              <p className="text-sm text-muted-foreground mb-8 text-center">{pinLabels[pinStep]}</p>
              <div className="flex gap-4 mb-10">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: pinEntry.length === i + 1 ? [1, 1.3, 1] : 1, background: i < pinEntry.length ? "oklch(0.74 0.18 25)" : "oklch(0.3 0.01 260)" }}
                    transition={{ duration: 0.18 }}
                    className="w-4 h-4 rounded-full"
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 w-full px-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
                  <button
                    key={i}
                    disabled={k === ""}
                    onClick={() => {
                      if (k === "⌫") { setPinEntry((p) => p.slice(0, -1)); return; }
                      if (k === "") return;
                      const next = pinEntry + k;
                      if (next.length <= 6) {
                        setPinEntry(next);
                        if (next.length === 6) {
                          setTimeout(() => {
                            setPinEntry("");
                            if (pinStep === "current") setPinStep("new");
                            else if (pinStep === "new") setPinStep("confirm");
                            else setPinStep("done");
                          }, 300);
                        }
                      }
                    }}
                    className={`h-14 rounded-2xl text-lg font-semibold flex items-center justify-center transition active:scale-95 ${k === "" ? "invisible" : "glass"}`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="py-10 flex flex-col items-center gap-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-20 h-20 rounded-full grad-mint flex items-center justify-center shadow-glow-teal">
                <Check className="w-10 h-10 text-background" strokeWidth={3} />
              </motion.div>
              <div className="text-lg font-semibold">PIN updated</div>
              <button onClick={close} className="mt-4 w-full grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral">Done</button>
            </div>
          )}
        </div>
      )}

      {section === "notifications" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground mb-2">Choose what you want to be notified about.</p>
          <Group title="Transactions">
            <Row icon={Bell} label="Deposits confirmed" right={<Toggle on={notifDeposit} onChange={setNotifDeposit} />} />
          </Group>
          <Group title="Progress">
            <Row icon={Bell} label="Vault milestones" right={<Toggle on={notifMilestone} onChange={setNotifMilestone} />} />
            <Row icon={Bell} label="Streak reminders" right={<Toggle on={notifStreak} onChange={setNotifStreak} />} />
            <Row icon={Bell} label="Price protection" right={<Toggle on={notifProtection} onChange={setNotifProtection} />} />
          </Group>
          <Group title="Summary">
            <Row icon={Bell} label="Weekly summary" right={<Toggle on={notifWeekly} onChange={setNotifWeekly} />} />
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
    <button onClick={(e) => { e.stopPropagation(); onChange(!on); }} className={`w-12 h-7 rounded-full p-0.5 transition shrink-0 ${on ? "grad-coral" : "bg-white/10"}`}>
      <motion.div layout className={`w-6 h-6 rounded-full bg-white shadow ${on ? "ml-auto" : ""}`} />
    </button>
  );
}
