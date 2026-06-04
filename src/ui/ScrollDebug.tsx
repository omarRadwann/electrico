"use client";

import { useExperience } from "@/src/store/useExperience";
import { ZONES } from "@/src/experience/cameraPath";

/**
 * TEMPORARY readout proving the scroll -> store -> camera spine (the diegetic
 * HUD replaces it in M6). It subscribes to the per-frame `progress`, which is
 * the deliberate exception to the per-frame no-subscribe rule — fine for a
 * throwaway debug element, but the pattern the Rig must NOT copy.
 */
export function ScrollDebug() {
  const progress = useExperience((s) => s.progress);
  const dimension = useExperience((s) => s.dimension);
  const zone = ZONES[dimension]?.name ?? "—";

  return (
    <div className="scroll-debug" aria-hidden="true">
      M1 · {(progress * 100).toFixed(0)}% · {String(dimension + 1).padStart(2, "0")}{" "}
      {zone}
    </div>
  );
}
