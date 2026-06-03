"use client";

import { useExperience } from "@/src/store/useExperience";

/**
 * TEMPORARY M0 readout that proves the Lenis -> store wiring (the M0 gate:
 * "smooth scroll value visible in the store"). The real diegetic HUD — depth
 * indicator + layer titles — replaces this in M6.
 *
 * It subscribes to the per-frame `progress`, which is acceptable for a throwaway
 * debug element but is the pattern the production Rig must NOT copy (see the
 * per-frame note in useExperience).
 */
export function ScrollDebug() {
  const progress = useExperience((s) => s.progress);
  const scroll = useExperience((s) => s.scroll);
  const dimension = Math.min(6, Math.floor(progress * 6) + 1);

  return (
    <div className="scroll-debug" aria-hidden="true">
      M0 · progress {progress.toFixed(3)} · {Math.round(scroll)}px · dim{" "}
      {dimension}/6
    </div>
  );
}
