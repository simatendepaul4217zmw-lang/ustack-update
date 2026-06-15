import { useEffect } from "react";
import { Sheet } from "./Sheet";
import { Trophy, ArrowDownToLine, ShieldCheck, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/lib/hooks/useAppData";

const iconMap = {
  milestone: Trophy, deposit: ArrowDownToLine, protection: ShieldCheck,
  summary: Sparkles, warning: AlertTriangle,
} as const;
const colorMap: Record<string, string> = {
  milestone: "oklch(0.86 0.13 160)", deposit: "oklch(0.73 0.19 55)", protection: "oklch(0.82 0.17 140)",
  summary: "oklch(0.74 0.18 55)", warning: "oklch(0.73 0.19 55)",
};

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: notifications = [], isLoading } = useNotifications();
  const { mutate: markRead } = useMarkNotificationsRead();

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => markRead(), 1500);
      return () => clearTimeout(timer);
    }
  }, [open, markRead]);

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-12">All caught up! No notifications yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const Icon = iconMap[n.kind as keyof typeof iconMap] ?? Sparkles;
            const color = colorMap[n.kind] ?? "oklch(0.73 0.19 55)";
            return (
              <div key={n.id} className="rounded-2xl bg-card/60 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-card border border-white/8 flex items-center justify-center shrink-0" style={{ color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{n.when}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
