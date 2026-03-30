"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const typeBorder: Record<string, string> = {
  deposit: "border-l-green-400",
  withdrawal: "border-l-orange-400",
  trade: "border-l-blue-400",
  system: "border-l-slate-500",
};

const typeIcon: Record<string, string> = {
  deposit: "text-green-400",
  withdrawal: "text-orange-400",
  trade: "text-blue-400",
  system: "text-slate-400",
};

const typeTitle: Record<string, string> = {
  deposit: "text-green-400",
  withdrawal: "text-orange-400",
  trade: "text-blue-400",
  system: "text-foreground",
};

/** Popup toasts for new notifications + refresh profile balance. OS deposit alerts if permitted. */
export function NotificationActivitySync() {
  const queryClient = useQueryClient();
  const seenIdsRef = useRef<Set<string> | null>(null);

  const { data: notifications = [] } = useQuery<NotificationRow[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 12000,
    staleTime: 8000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }

    const fresh: NotificationRow[] = [];
    for (const n of notifications) {
      if (seenIdsRef.current.has(n.id)) continue;
      seenIdsRef.current.add(n.id);
      fresh.push(n);
    }

    if (fresh.length === 0) return;

    for (const n of fresh) {
      const b = typeBorder[n.type] ?? "border-l-[#00D4FF]";
      const ic = typeIcon[n.type] ?? "text-[#00D4FF]";
      const tit = typeTitle[n.type] ?? "text-[#00D4FF]";

      toast.custom(
        () => (
          <div
            className={cn(
              "pointer-events-auto flex w-[min(calc(100vw-2rem),24rem)] gap-3 rounded-xl border border-white/10 bg-[#151822] p-4 shadow-xl border-l-[3px]",
              b
            )}
          >
            <Bell className={cn("h-5 w-5 shrink-0 mt-0.5", ic)} />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-semibold leading-snug", tit)}>{n.title}</p>
              <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">{n.message}</p>
            </div>
          </div>
        ),
        {
          id: `notif-toast-${n.id}`,
          duration: 12000,
        }
      );

      if (
        n.type === "deposit" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(n.title, { body: n.message, tag: n.id });
        } catch {
          /* ignore */
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [notifications, queryClient]);

  return null;
}
