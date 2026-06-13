"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "@/src/store/useExperience";
import { track } from "@/src/lib/analytics";

/**
 * Funnel telemetry bridge (briefing §13). Subscribes ONLY to low-frequency
 * store values (dimension, completedOnce, terminalOpen, a derived loader
 * boolean) — never to scroll/progress/velocity, per the per-frame discipline.
 * CTA/channel clicks are tracked at their click handlers in ContactTerminal;
 * this component owns the passive funnel beats. Renders nothing.
 *
 * Mounted in page.tsx OUTSIDE the ExperienceBoundary so the funnel keeps
 * counting even when WebGL dies and the 3D island unmounts.
 */
export function AnalyticsBridge() {
  // Derived boolean keeps re-renders to the single 0→1 flip, not every
  // LoadingManager increment the Loader mirrors into the store.
  const loaderDone = useExperience((s) => s.loadProgress >= 1);
  const dimension = useExperience((s) => s.dimension);
  const completedOnce = useExperience((s) => s.completedOnce);
  const terminalOpen = useExperience((s) => s.terminalOpen);

  // 'loader-done' — once per session, when the loader actually dismisses.
  const firedLoader = useRef(false);
  useEffect(() => {
    if (loaderDone && !firedLoader.current) {
      firedLoader.current = true;
      track("loader-done");
    }
  }, [loaderDone]);

  // 'dimension' — every CHANGE (dive depth per zone). The boot value (0) is
  // skipped: being born in the City is not "reaching" it.
  const prevDim = useRef<number | null>(null);
  useEffect(() => {
    if (prevDim.current !== null && prevDim.current !== dimension) {
      track("dimension", { index: dimension });
    }
    prevDim.current = dimension;
  }, [dimension]);

  // 'loop-completed' — once: the flag never resets within a session.
  const firedLoop = useRef(false);
  useEffect(() => {
    if (completedOnce && !firedLoop.current) {
      firedLoop.current = true;
      track("loop-completed");
    }
  }, [completedOnce]);

  // 'terminal-open' — every false→true edge (each summon is a funnel step).
  const prevTerm = useRef(false);
  useEffect(() => {
    if (terminalOpen && !prevTerm.current) track("terminal-open");
    prevTerm.current = terminalOpen;
  }, [terminalOpen]);

  return null;
}
