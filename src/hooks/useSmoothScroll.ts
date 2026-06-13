"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { useExperience, registerScrollToProgress } from "@/src/store/useExperience";

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
  // Low-frequency flag; an effect dep on purpose — `infinite`/`lerp` are
  // constructor-time Lenis options, so a live toggle recreates the instance.
  const reducedMotion = useExperience((s) => s.reducedMotion);

  useEffect(() => {
    // TOUCH GETS A RESOLVED ENDING, NOT THE LOOP. Lenis requires `syncTouch`
    // for `infinite` to work on touch (per its README) — without it native touch
    // scroll clamps at the document end, progress parks at 1.0, and the LoopVeil
    // sits fully opaque over the contact content (the mobile P0). Rather than
    // syncTouch (which replaces native touch feel wholesale), any touch-capable
    // device gets a non-looping dive that resolves at the end — the intended
    // mobile ending. maxTouchPoints catches touch laptops too: they CAN touch-
    // scroll, which would hit the same parked-veil failure.
    const coarse =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches === true ||
        navigator.maxTouchPoints > 0);

    // The store flag may not be seeded yet on first mount (QualityController
    // lives inside the Canvas), so consult the media query directly as well.
    const prefersReduced =
      useExperience.getState().reducedMotion ||
      (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);

    // `infinite` (the endless dive) only on fine pointers without reduced
    // motion. Reduced motion also drops the smoothing entirely: lerp 1 tracks
    // the scrollbar 1:1 — no inertia, no overshoot, no surprise drift.
    const lenis = new Lenis({
      autoRaf: true,
      infinite: !coarse && !prefersReduced,
      ...(prefersReduced ? { lerp: 1 } : null),
    });

    // Dev-only: expose the Lenis instance so a real browser can drive scroll
    // deterministically (lenis.scrollTo) during verification. Stripped in prod.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    // Imperative scroll-navigation channel (store module fn): HUD rail ticks /
    // skip controls map a dive progress onto Lenis' range without owning Lenis.
    registerScrollToProgress((p, immediate) => {
      lenis.scrollTo(p * lenis.limit, immediate ? { immediate: true } : { duration: 1.6 });
    });

    let prevProgress = lenis.progress;
    const unsubscribe = lenis.on("scroll", (l: Lenis) => {
      const st = useExperience.getState();
      // BACKWARD-WRAP GUARD: until the dive has been completed once, a
      // first-gesture scroll-UP wraps 0 → ~0.97 (the veil pops at half strength
      // and the Rig teleports to the climax). An UPWARD progress jump > 0.5 in
      // one event can only be that wrap — snap back to 0 and drop this frame's
      // store write. (Forward wraps 1 → 0 are a downward jump; unaffected.)
      if (!st.completedOnce && l.progress - prevProgress > 0.5) {
        lenis.scrollTo(0, { immediate: true });
        prevProgress = 0;
        return;
      }
      // Reaching the end NORMALLY (scrolled, not wrap-jumped) unlocks backward
      // wrapping + arms the veil in both directions for the rest of the session.
      if (!st.completedOnce && l.progress >= 0.97) st.setCompletedOnce(true);
      prevProgress = l.progress;
      setScroll(l.scroll, l.progress, l.velocity);
    });

    // Cleanup must be correct: React 19 StrictMode mounts effects twice in dev,
    // so a leaked Lenis instance would double-bind wheel/touch listeners.
    return () => {
      unsubscribe();
      registerScrollToProgress(null);
      lenis.destroy();
    };
  }, [setScroll, reducedMotion]);
}
