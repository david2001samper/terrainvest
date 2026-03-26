"use client";

import { useEffect, useState, useCallback } from "react";

export function useInView(options?: {
  rootMargin?: string;
  once?: boolean;
}) {
  const { rootMargin = "120px", once = true } = options ?? {};
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  const ref = useCallback((el: HTMLDivElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node || inView) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0 }
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, [node, inView, once, rootMargin]);

  return { ref, inView };
}
