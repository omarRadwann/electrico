"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useExperience } from "@/src/store/useExperience";

/**
 * Branded loader / title screen (spec §3.4): the "powering on" moment, tied to
 * REAL asset-load progress (drei useProgress reads the three LoadingManager).
 * On completion it fades out to reveal the City, then a "scroll to dive" cue
 * appears and disappears on first scroll. Min display so the brand moment reads
 * even when assets load instantly.
 */
export function Loader() {
  const { progress, active } = useProgress();
  const [minElapsed, setMinElapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Derived during render (no setState-in-effect): the loader is done once the
  // min beat has passed and all assets are loaded; the cue shows until first scroll.
  const done = minElapsed && progress >= 100 && !active;
  const showCue = done && !dismissed;

  // Dismiss the cue on the first real scroll (setState in a callback — allowed).
  useEffect(() => {
    if (!showCue) return;
    let raf = 0;
    const tick = () => {
      if (useExperience.getState().progress > 0.004) {
        setDismissed(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showCue]);

  return (
    <>
      <div className={`loader${done ? " is-done" : ""}`} aria-hidden={done}>
        <div className="loader-mark">ELECTRICO</div>
        <div className="loader-bar">
          <span style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="loader-pct">{Math.round(Math.min(progress, 100))}% · powering the grid</div>
      </div>

      {showCue && (
        <div className="scroll-cue" aria-hidden="true">
          <span>Scroll to dive</span>
          <span className="scroll-cue-arrow" />
        </div>
      )}
    </>
  );
}
