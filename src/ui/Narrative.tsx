"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useExperience } from "@/src/store/useExperience";
import { ZONES } from "@/src/experience/cameraPath";

/**
 * The editorial narrative line, driven by the active `dimension` (the SAME store
 * value the HUD reads) — so the on-screen sentence is always the one for the scene
 * the camera is actually framing. The crawlable copies live in <main className=
 * "content"> (page.tsx) for SEO + scroll height; this synced overlay is what reads
 * on screen, replacing those scroll-positioned lines which drifted out of sync with
 * the authored (non-linear) camera keyframes.
 *
 * Mirrors page.tsx's six narrative lines (one per dimension, in ZONES order).
 */
const LINES = [
  "We keep the city alive.",
  "We raise the structures behind it.",
  "Bones engineered to last.",
  "We make it think.",
  "We install and maintain the nerves.",
  "Energy, endlessly.",
];

export function Narrative() {
  const dimension = useExperience((s) => s.dimension);
  const rootRef = useRef<HTMLDivElement>(null);

  // Show only during the dive — past the hero (whose own tagline carries the
  // opening) and before the loop veil. progress is high-frequency: drive via rAF,
  // write the attribute only when the threshold is crossed (no per-frame churn).
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const p = useExperience.getState().progress;
      const show = p > 0.08 && p < 0.97 ? "1" : "0";
      if (show !== last && rootRef.current) {
        rootRef.current.dataset.show = show;
        last = show;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const zone = ZONES[dimension];

  return (
    <div className="narrative-hud" ref={rootRef} data-show="0" aria-hidden="true">
      {/* keyed on dimension so each line re-triggers its entrance animation */}
      <p
        className="narrative-hud-line"
        key={dimension}
        style={{ ["--ac"]: zone?.color ?? "#e8a23d" } as CSSProperties}
      >
        {LINES[dimension] ?? ""}
      </p>
    </div>
  );
}
