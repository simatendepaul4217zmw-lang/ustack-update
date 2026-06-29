import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, ShieldCheck, ChevronRight } from "lucide-react";
import { PhoneFrame } from "@/components/ustack/PhoneFrame";
import { Logo } from "@/components/ustack/Logo";
import { requestOtp, verifyOtp } from "@/lib/api/auth.functions";
import { useAuth } from "@/lib/context/auth-context";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account - UStack" },
      { name: "description", content: "Start saving Bitcoin with UStack." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<"details" | "otp" | "done">("details");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const goBack = () => {
    if (step === "otp") { setStep("details"); setError(""); setOtp(["","","","","",""]); }
    else nav({ to: "/onboarding" });
  };

  const handleSendOtp = async () => {
    if (!username.trim() || !email.trim()) return;
    setError(""); setLoading(true);
    try {
      await requestOtp({ data: { email } });
      setStep("otp");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    setError(""); setLoading(true);
    try {
      const res = await verifyOtp({ data: { email, code, username: username.trim() } });
      login(res.accessToken, res.refreshToken, res.user);
      setStep("done");
      setTimeout(() => nav({ to: "/app" }), 1600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <PhoneFrame>
        <div className="h-full flex flex-col items-center justify-center gap-6 bg-background">
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }}>
            <div className="w-28 h-28 rounded-full bg-card border border-white/8 flex items-center justify-center" style={{ color: "oklch(0.86 0.13 160)" }}>
              <ShieldCheck className="w-14 h-14" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
            <div className="text-2xl font-semibold">You're in, {username}!</div>
            <div className="text-sm text-muted-foreground mt-1">Building your first vault…</div>
          </motion.div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="h-full flex flex-col bg-background">
        <div className="flex flex-col flex-1 px-7 pt-12 pb-10">
          <button onClick={goBack} className="w-10 h-10 rounded-full glass flex items-center justify-center self-start">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mt-8">
            <Logo size={36} />
            <span className="text-base font-semibold tracking-wide">UStack</span>
          </div>

          <div className="flex gap-2 mt-6">
            {(["details", "otp"] as const).map((s, i) => {
              const idx = ["details", "otp"].indexOf(step);
              return (
                <motion.div
                  key={s}
                  animate={{ width: s === step ? 24 : 8, opacity: i <= idx ? 1 : 0.3 }}
                  className="h-1.5 rounded-full"
                  style={{ background: i <= idx ? "oklch(0.73 0.19 55)" : "oklch(0.4 0.01 260)" }}
                />
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="flex flex-col flex-1">
                <div className="mt-6">
                  <h1 className="text-[2rem] font-semibold tracking-tight leading-tight">Create your<br />account</h1>
                  <p className="mt-2 text-muted-foreground text-sm">Minimal data. Maximum privacy.</p>
                </div>
                <div className="mt-8 flex flex-col gap-4">
                  <Field label="Username" placeholder="@yourname" value={username} onChange={setUsername} />
                  <Field label="Email address" placeholder="you@example.com" value={email} onChange={setEmail} type="email" />
                </div>
                <div className="mt-5 glass rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed">
                  We never sell your data. No aggressive KYC, just what's needed to keep your stack safe.
                </div>
                {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}
                <div className="flex-1" />
                <button
                  onClick={handleSendOtp}
                  disabled={!username || !email || loading}
                  className="bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Spinner /> : <><span>Continue</span><ChevronRight className="w-4 h-4" /></>}
                </button>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => nav({ to: "/auth" })} className="text-[oklch(0.82_0.13_190)] font-medium">Log in</button>
                </p>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="flex flex-col flex-1">
                <div className="mt-6">
                  <h1 className="text-[2rem] font-semibold tracking-tight leading-tight">Check your<br />email</h1>
                  <p className="mt-2 text-muted-foreground text-sm">We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span></p>
                </div>

                <div className="mt-10 flex gap-2 justify-center">
                  {otp.map((v, idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      inputMode="numeric"
                      maxLength={1}
                      value={v}
                      autoFocus={idx === 0}
                      onChange={(e) => {
                        const nv = [...otp];
                        nv[idx] = e.target.value.replace(/\D/g, "").slice(-1);
                        setOtp(nv);
                        if (e.target.value && idx < 5) {
                          (document.getElementById(`otp-${idx + 1}`) as HTMLInputElement)?.focus();
                        }
                        if (idx === 5 && e.target.value) {
                          setTimeout(() => {
                            const code = [...nv].join("");
                            if (code.length === 6) handleVerify();
                          }, 100);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !v && idx > 0) {
                          (document.getElementById(`otp-${idx - 1}`) as HTMLInputElement)?.focus();
                        }
                      }}
                      className="w-12 h-14 text-center text-xl font-semibold rounded-2xl bg-card border border-border focus:border-primary focus:outline-none transition"
                    />
                  ))}
                </div>

                {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}

                <div className="mt-4 text-center">
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-sm text-[oklch(0.82_0.13_190)] font-medium disabled:opacity-40"
                  >
                    Resend code
                  </button>
                </div>

                <div className="flex-1" />

                <button
                  onClick={handleVerify}
                  disabled={otp.some((v) => !v) || loading}
                  className="bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading ? <Spinner /> : <><span>Verify & Create Account</span><ChevronRight className="w-4 h-4" /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PhoneFrame>
  );
}

function Field({ label, placeholder, value, onChange, type = "text" }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-card border border-border rounded-2xl px-4 py-4 text-base focus:border-primary focus:outline-none transition"
      />
    </label>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white"
    />
  );
}
