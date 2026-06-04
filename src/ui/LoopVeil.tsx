"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";

/**
 * Masks the endless-loop seam (Current → City wrap, spec §3.2). A full-screen
 * veil ramps opaque as the camera reaches the end and fades back as it re-enters
 * the City, hiding the scroll/content snap at the wrap. Only arms after the first
 * approach to the end, so the *initial* load isn't veiled. Self-contained rAF —
 * mutates the DOM directly, never re-renders React.
 */
export function LoopVeil() {
  const ref = useRef<HTMLDivElement>(null);
  const reachedEnd = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = useExperience.getState().progress;
      if (p > 0.9) reachedEnd.current = true;

      let o = 0;
      if (p > 0.94) {
        o = (p - 0.94) / 0.06; // ramp up approaching the end
      } else if (p < 0.06 && reachedEnd.current) {
        o = 1 - p / 0.06; // ramp down after wrapping back into the City
      }

      const el = ref.current;
      if (el) el.style.opacity = String(clamp(o, 0, 1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className="loop-veil" aria-hidden="true" />;
}
