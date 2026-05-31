import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Camera } from "lucide-react";
import { Sheet } from "./Sheet";

const AVATARS = ["NK", "SA", "TM", "BK", "LM", "JP", "RN", "EM"];
const GRADS = ["grad-mint", "grad-coral", "grad-teal", "grad-btc", "grad-mint", "grad-coral", "grad-teal", "grad-btc"];

export function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("Norman K.");
  const [username, setUsername] = useState("@norman");
  const [phone, setPhone] = useState("+260 ••• 4421");
  const [avatarIdx, setAvatarIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit Profile">
      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div key="saved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-14 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full grad-mint flex items-center justify-center shadow-glow-teal">
              <Check className="w-10 h-10 text-background" strokeWidth={3} />
            </div>
            <div className="text-lg font-semibold">Profile updated</div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Avatar picker */}
            <div className="flex flex-col items-center gap-3">
              <div className={`relative w-24 h-24 rounded-3xl ${GRADS[avatarIdx]} flex items-center justify-center text-background text-3xl font-semibold shadow-glow-coral`}>
                {AVATARS[avatarIdx]}
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full glass flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
              <div className="flex gap-2">
                {GRADS.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setAvatarIdx(i)}
                    className={`w-8 h-8 rounded-full ${g} transition ${avatarIdx === i ? "ring-2 ring-white/60 scale-110" : "opacity-60"}`}
                  />
                ))}
              </div>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-4">
              <Field label="Full name" value={name} onChange={setName} placeholder="Your name" />
              <Field label="Username" value={username} onChange={setUsername} placeholder="@handle" />
              <Field label="Phone number" value={phone} onChange={setPhone} placeholder="+260 …" />
            </div>

            <button
              onClick={save}
              className="mt-2 grad-coral text-primary-foreground font-semibold py-4 rounded-2xl shadow-glow-coral active:scale-[0.98] transition"
            >
              Save changes
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-card border border-border rounded-2xl px-4 py-3.5 text-base focus:border-primary focus:outline-none focus:shadow-glow-coral transition"
      />
    </label>
  );
}
