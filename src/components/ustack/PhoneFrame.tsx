import { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center md:p-8 relative overflow-hidden">
      <div className="relative w-full md:w-[420px] md:h-[860px] h-[100dvh] md:rounded-[3rem] overflow-hidden md:border md:border-white/10 md:shadow-float bg-background">
        <div className="absolute inset-0 overflow-y-auto no-scrollbar">{children}</div>
      </div>
    </div>
  );
}
