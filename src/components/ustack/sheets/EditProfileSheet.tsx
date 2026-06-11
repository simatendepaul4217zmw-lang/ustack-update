import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { useAuth } from "@/lib/context/auth-context";
import { useUpdateProfile } from "@/lib/hooks/useAppData";

const COLORS = [
  "oklch(0.86 0.13 160)",
  "oklch(0.73 0.19 55)",
  "oklch(0.78 0.14 190)",
  "oklch(0.74 0.18 55)",
  "oklch(0.72 0.17 290)",
  "oklch(0.82 0.13 355)",
  "oklch(0.80 0.14 110)",
  "oklch(0.75 0.15 220)",
];

export function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const updateProfileMut = useUpdateProfile();

  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(profile?.display_name ?? user?.username ?? "");
      setSelectedColor(profile?.avatar_color ?? COLORS[0]);
      setSaved(false);
      setError("");
    }
  }, [open, user, profile]);

  const initials = name.trim()
    ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : (profile?.avatar_initials ?? user?.username?.slice(0, 2).toUpperCase() ?? "??");

  const save = async () => {
    setError("");
    try {
      await updateProfileMut.mutateAsync({ displayName: name.trim(), avatarColor: selectedColor });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit Profile">
      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div key="saved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-14 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.86 0.13 160)" }}>
              <Check className="w-10 h-10" strokeWidth={3} />
            </div>
            <div className="text-lg font-semibold">Profile updated</div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center text-white text-3xl font-semibold transition-all"
                style={{ background: selectedColor }}
              >
                {initials}
              </div>
              <div className="flex gap-2">
                {COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(c)}
                    className={`w-8 h-8 rounded-full transition ${selectedColor === c ? "ring-2 ring-white/60 scale-110" : "opacity-60"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Field label="Display name" value={name} onChange={setName} placeholder="Your name" />
              <ReadonlyField label="Username" value={`@${user?.username ?? ""}`} note="Cannot be changed" />
              <ReadonlyField label="Email address" value={user?.email ?? ""} note="Requires re-verification to change" />
            </div>

            {error && (
              <div className="text-sm text-destructive text-center">{error}</div>
            )}

            <button
              onClick={save}
              disabled={updateProfileMut.isPending || !name.trim()}
              className="mt-2 bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {updateProfileMut.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : "Save changes"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function maskPhone(phone: string) {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length < 8) return phone || "—";
  return `${cleaned.slice(0, 4)} ••• ${cleaned.slice(-4)}`;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-card border border-border rounded-2xl px-4 py-3.5 text-base focus:border-primary focus:outline-none transition"
      />
    </label>
  );
}

function ReadonlyField({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</span>
      <div className="bg-card/50 border border-border/50 rounded-2xl px-4 py-3.5 text-base text-muted-foreground flex items-center justify-between">
        <span>{value}</span>
        <span className="text-[10px] text-muted-foreground/50 ml-2">{note}</span>
      </div>
    </div>
  );
}
