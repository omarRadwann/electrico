"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";

/**
 * Masks the endless-loop seam (Current → City wrap, spec §3.2). A full-screen
 * veil ramps up as the camera reaches the end and fades back as it re-enters
 * the City, hiding the scroll/content snap at the wrap. Self-contained rAF —
 * mutates the DOM directly, never re-renders React.
 *
 * Arming: BOTH ramps gate on the store's `completedOnce` (set by the Rig once
 * the visitor has genuinely reached the end), replacing the old local
 * reached-end ref — so the veil can't pop during the reverse-entry wrap (first
 * gesture scroll-UP teleporting 0→0.97) and the initial load is never veiled.
 *
 * Opacity is CAPPED below full black: a visitor parked at p≈1 (the old mobile
 * strand spot) always keeps a hint of the world, and the contact terminal sits
 * above this layer anyway (z-60 vs 40).
 */
const MAX_OPACITY = 0.85;

export function LoopVeil() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = useExperience.getState();
      const p = s.progress;

      let o = 0;
      if (s.completedOnce) {
        if (p > 0.94) {
          o = (p - 0.94) / 0.06; // ramp up approaching the end
        } else if (p < 0.06) {
          o = 1 - p / 0.06; // ramp down after wrapping back into the City
        }
      }

      const el = ref.current;
      if (el) el.style.opacity = String(clamp(o, 0, 1) * MAX_OPACITY);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className="loop-veil" aria-hidden="true" />;
}
