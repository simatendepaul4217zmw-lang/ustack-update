import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { PhoneFrame } from "@/components/ustack/PhoneFrame";
import { Logo } from "@/components/ustack/Logo";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome - UStack" },
      { name: "description", content: "Build long-term Bitcoin habits with UStack." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <PhoneFrame>
      <div className="h-full flex flex-col items-center justify-between px-7 pt-14 pb-10 bg-background">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <Logo size={52} />
          <div className="mt-2.5 text-sm font-semibold tracking-widest text-muted-foreground uppercase">UStack</div>
        </motion.div>

        <div className="flex flex-col items-center text-center px-2">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-[2.4rem] leading-[1.08] font-semibold tracking-tight"
          >
            Save Bitcoin<br />the smart way.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-4 text-[0.95rem] text-muted-foreground leading-relaxed max-w-[18rem]"
          >
            Build long-term Bitcoin habits. Stack slowly. Stay disciplined. Grow calmly.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="w-full flex flex-col gap-3"
        >
          <Link
            to="/onboarding"
            className="bg-primary text-primary-foreground font-semibold py-[1.05rem] rounded-2xl text-center text-[0.95rem] active:scale-[0.98] transition"
          >
            Get Started
          </Link>
          <Link
            to="/auth"
            className="glass text-foreground font-medium py-[1.05rem] rounded-2xl text-center text-[0.95rem] active:scale-[0.98] transition"
          >
            Log In
          </Link>
        </motion.div>
      </div>
    </PhoneFrame>
  );
}
