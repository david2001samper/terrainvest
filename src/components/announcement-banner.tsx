"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { useState } from "react";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ["announcement"],
    queryFn: async () => {
      const res = await fetch("/api/announcement");
      if (!res.ok) return { announcement: "" };
      return res.json();
    },
    staleTime: 60000,
  });

  const text = data?.announcement?.trim() ?? "";
  if (!text || dismissed) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <Megaphone className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-200 truncate">{text}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded hover:bg-amber-500/20 text-amber-400"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
