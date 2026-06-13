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
 *
 * The whole loader is aria-hidden decoration: the page's real <h1> + content live
 * in <main> (one-h1 hygiene — this surface previously shipped a second h1).
 */
const SPARKS = 16;
/** The dismiss fade is 1s (globals.css .loader transition) — unmount just after. */
const UNMOUNT_AFTER_DONE_MS = 1200;

export function Loader() {
  const { progress, active } = useProgress();
  const setLoadProgress = useExperience((s) => s.setLoadProgress);
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceDone, setForceDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    // Min display so the brand moment reads even on an instant load.
    const t = setTimeout(() => setMinElapsed(true), 1400);
    // Anti-stick ceiling — bandwidth-aware (briefing §9: never force-dismiss
    // into a visibly popping world; the old 7s fired mid-download on median
    // 4G). 20s covers a slow full payload; 30s on confirmed 2g-class links
    // where assets are genuinely still arriving. navigator.connection is
    // Chromium-only — when absent we keep the 20s baseline.
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } })
      .connection;
    // Bounded entry: the City (first view) is procedural + needs only the engine
    // chunk + the small night HDRI, so we never make the visitor wait for the full
    // payload. The Room GLBs / surface maps stream in while they explore the City →
    // Building → Frame (≈60% of the dive) and are ready before dimension 4. 9s
    // baseline, 15s on confirmed 2g-class links where even the engine chunk crawls.
    const ceiling = conn?.effectiveType?.includes("2g") ? 15000 : 9000;
    const f = setTimeout(() => setForceDone(true), ceiling);
    return () => {
      clearTimeout(t);
      clearTimeout(f);
    };
  }, []);

  const pct = Math.round(Math.min(progress, 100));
  const done = (minElapsed && pct >= 100 && !active) || forceDone;
  const showCue = done && !dismissed;

  // Mirror load state into the store (low-frequency: LoadingManager events
  // only, not per-frame). Pinned below 1 until the loader actually dismisses,
  // so AnalyticsBridge's 'loader-done' fires when the visitor first SEES the
  // world — including the forceDone path.
  useEffect(() => {
    setLoadProgress(done ? 1 : Math.min(pct, 99) / 100);
  }, [done, pct, setLoadProgress]);

  // UNMOUNT after the dismiss fade: 16 infinite spark animations + a blurred
  // glow must not keep costing compositor time behind opacity:0 forever.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setUnmounted(true), UNMOUNT_AFTER_DONE_MS);
    return () => clearTimeout(t);
  }, [done]);

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
      {!unmounted && (
        <div className={`loader${done ? " is-done" : ""}`} aria-hidden="true">
          {/* Charged electric field — drifting sparks + a pulsing core glow. */}
          <div className="loader-field" aria-hidden="true">
            {Array.from({ length: SPARKS }).map((_, i) => (
              <span key={i} className="loader-spark" style={{ ["--i"]: i } as CSSProperties} />
            ))}
          </div>
          <div className="loader-inner">
            <p className="loader-eyebrow">Power · Structure · Smart systems</p>
            {/* div, not h1 — the document's single h1 is the hero brandmark. */}
            <div className="loader-mark">ELECTRICO</div>
            <div className="loader-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="loader-pct">{pct}% · powering the grid</p>
          </div>
        </div>
      )}

      {showCue && (
        <div className="scroll-cue" aria-hidden="true">
          <span>Scroll to dive</span>
          <span className="scroll-cue-arrow" />
        </div>
      )}
    </>
  );
}
