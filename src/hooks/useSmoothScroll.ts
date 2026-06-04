"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useExperience } from "@/src/store/useExperience";

/**
 * Initializes Lenis once and mirrors its smoothed scroll into the global store
 * (spec §3.1 — "establish one scroll value, read it everywhere").
 *
 * Lenis on `window` drives the *real* native scroll position (no DOM transform),
 * so `position: fixed` / `sticky` keep working — that is exactly why the 3D
 * canvas can sit fixed behind the scrollable content. `autoRaf: true` lets Lenis
 * run its own RAF loop; we only forward each update into the store, and R3F reads
 * it via `getState()` inside `useFrame`.
 */
export function useSmoothScroll(): void {
  const setScroll = useExperience((s) => s.setScroll);

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true });

    // Dev-only: expose the Lenis instance so a real browser can drive scroll
    // deterministically (lenis.scrollTo) during verification. Stripped in prod.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    const unsubscribe = lenis.on("scroll", (l: Lenis) => {
      setScroll(l.scroll, l.progress, l.velocity);
    });

    // Cleanup must be correct: React 19 StrictMode mounts effects twice in dev,
    // so a leaked Lenis instance would double-bind wheel/touch listeners.
    return () => {
      unsubscribe();
      lenis.destroy();
    };
  }, [setScroll]);
}
