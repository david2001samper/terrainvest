"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
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

function showNotificationToast(n: NotificationRow) {
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
    { id: `notif-toast-${n.id}`, duration: 12000 }
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

async function patchMarkRead(id: string) {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

async function patchMarkAllRead() {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mark_all_read: true }),
  });
}

function tabIsVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * While logged in with the tab visible: new notifications are shown once and marked read on the server.
 * At session start (e.g. after login): unread backlog is shown once, then marked read — they stay in history, no repeat toasts later.
 * If the tab is hidden, delivery is deferred until the tab is visible.
 */
export function NotificationActivitySync() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const userId = profile?.id;

  const initialHandledRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const sessionGenRef = useRef(0);
  const pendingLiveRef = useRef<NotificationRow[]>([]);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const { data: notificationsData, isFetched } = useQuery<NotificationRow[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(userId),
    refetchInterval: 12000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const notifications = notificationsData ?? [];

  useEffect(() => {
    if (!userId) {
      prevUserIdRef.current = undefined;
      return;
    }
    if (prevUserIdRef.current === userId) return;
    prevUserIdRef.current = userId;
    sessionGenRef.current += 1;
    initialHandledRef.current = false;
    knownIdsRef.current = new Set();
    pendingLiveRef.current = [];
  }, [userId]);

  const flushPendingLive = useCallback(async (uid: string) => {
    const batch = pendingLiveRef.current.splice(0);
    if (batch.length === 0) return;
    for (const n of batch) {
      showNotificationToast(n);
      await patchMarkRead(n.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["notifications", uid] });
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]);

  const processInitialSession = useCallback(async (rows: NotificationRow[], uid: string) => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;
    const gen = sessionGenRef.current;

    for (const n of rows) {
      knownIdsRef.current.add(n.id);
    }

    const unread = rows.filter((n) => !n.read);
    for (const n of unread) {
      showNotificationToast(n);
    }

    await patchMarkAllRead();

    if (gen !== sessionGenRef.current) return;

    await queryClient.invalidateQueries({ queryKey: ["notifications", uid] });
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;

    function onVisibility() {
      if (!tabIsVisible()) return;
      if (!initialHandledRef.current) {
        const state = queryClient.getQueryState(["notifications", uid]);
        if (!state || state.fetchStatus === "fetching" || state.status === "pending") return;
        const latest =
          queryClient.getQueryData<NotificationRow[]>(["notifications", uid]) ?? [];
        void processInitialSession(latest, uid);
      } else {
        void flushPendingLive(uid);
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId, queryClient, processInitialSession, flushPendingLive]);

  useEffect(() => {
    if (!userId || !isFetched) return;

    if (!initialHandledRef.current) {
      if (tabIsVisible()) {
        void processInitialSession(notifications, userId);
      }
      return;
    }

    const newRows = notifications.filter((n) => !knownIdsRef.current.has(n.id));
    for (const n of newRows) {
      knownIdsRef.current.add(n.id);
    }

    const unreadNew = newRows.filter((n) => !n.read);
    if (unreadNew.length === 0) return;

    if (!tabIsVisible()) {
      pendingLiveRef.current.push(...unreadNew);
      return;
    }

    void (async () => {
      for (const n of unreadNew) {
        showNotificationToast(n);
        await patchMarkRead(n.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    })();
  }, [notifications, queryClient, userId, isFetched, processInitialSession]);

  return null;
}
