"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useProgress } from "@react-three/drei";
import { useExperience } from "@/src/store/useExperience";

/**
 * Branded loader / title screen (spec §3.4): the "powering on" moment, tied to REAL
 * asset-load progress (drei useProgress reads the three LoadingManager). A charged
 * electric field (drifting sparks + a pulsing core glow) sits behind the wordmark,
 * a glowing charge-bar fills, then on completion the mark SURGES and the screen
 * fades to reveal the City. A safety timeout guarantees it never sticks even if the
 * loading manager stalls. The "scroll to dive" cue appears after, until first scroll.
 */
const SPARKS = 16;

export function Loader() {
  const { progress, active } = useProgress();
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceDone, setForceDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Min display so the brand moment reads even on an instant load.
    const t = setTimeout(() => setMinElapsed(true), 1400);
    // Safety net: never let the intro stick if the loading manager stalls.
    const f = setTimeout(() => setForceDone(true), 7000);
    return () => {
      clearTimeout(t);
      clearTimeout(f);
    };
  }, []);

  const pct = Math.round(Math.min(progress, 100));
  const done = (minElapsed && pct >= 100 && !active) || forceDone;
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
        {/* Charged electric field — drifting sparks + a pulsing core glow. */}
        <div className="loader-field" aria-hidden="true">
          {Array.from({ length: SPARKS }).map((_, i) => (
            <span key={i} className="loader-spark" style={{ ["--i"]: i } as CSSProperties} />
          ))}
        </div>
        <div className="loader-inner">
          <p className="loader-eyebrow">Power · Structure · Smart systems</p>
          <h1 className="loader-mark">ELECTRICO</h1>
          <div className="loader-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="loader-pct">{pct}% · powering the grid</p>
        </div>
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
