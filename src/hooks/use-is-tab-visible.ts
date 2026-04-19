"use client";

import { useEffect, useState } from "react";

/**
 * Live "is this tab visible" signal. Used to suspend background polling
 * (`refetchInterval: visible ? Xms : false`) when the user has the tab
 * in the background, dramatically reducing API traffic, CPU, and battery
 * cost. React Query refetches automatically on focus thanks to
 * `refetchOnWindowFocus: true`.
 */
export function useIsTabVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden"
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}
