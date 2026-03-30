"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function requestDesktopPermission() {
    if (typeof Notification === "undefined") return;
    const r = await Notification.requestPermission();
    if (r === "granted") {
      toast.success("Desktop alerts enabled for new deposits while this tab is open");
    } else if (r === "denied") {
      toast.error("Notifications blocked — enable them in your browser settings");
    }
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const typeColor: Record<string, string> = {
    withdrawal: "text-orange-400",
    deposit: "text-green-400",
    trade: "text-blue-400",
    system: "text-muted-foreground",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-10 w-10 p-0"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(calc(100vw-1rem),26rem)] p-0 bg-card border-border sm:w-[26rem]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h4 className="text-base font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-3 text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>
        {typeof Notification !== "undefined" && Notification.permission === "default" && (
          <div className="px-5 py-3 border-b border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 text-sm justify-start gap-2"
              onClick={requestDesktopPermission}
            >
              <MonitorSmartphone className="w-4 h-4" />
              Enable desktop alerts (deposits)
            </Button>
          </div>
        )}
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-base text-muted-foreground px-4">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors ${
                  n.read ? "opacity-60" : "bg-accent/5"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${typeColor[n.type] || "text-foreground"}`}>
                    {n.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => markRead(n.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
