"use client";

import { useEffect, useRef } from "react";
import { useExperience } from "@/src/store/useExperience";
import {
  ensureStarted,
  playBoundaryStinger,
  setDimension,
  setEnabled,
  setWind,
} from "@/src/audio/ambientEngine";

/**
 * Bridge between the store and the ambient audio engine. The AudioContext is
 * created + resumed inside the sound-toggle's click (the autoplay gesture, see
 * Hud) — every engine call here no-ops until that gesture, so all of this is
 * safe pre-start. Four jobs:
 *
 *  1. Sync `audioOn` / `dimension` to the engine (low-frequency subscriptions).
 *  2. Persist the preference ('electrico-audio') and, when a visit boots with
 *     it ON, re-arm via a one-time pointerdown/keydown — the first gesture
 *     anywhere restarts the engine gesture-safely and syncs the store flag.
 *  3. Velocity wind: a self-contained rAF lerps |store velocity| (read via
 *     getState(), never a hook selector — per-frame discipline) into the
 *     engine's wind bus. Sound confirms motion.
 *  4. Boundary stingers: fire a one-shot per store `lastBoundary` event — the
 *     same edge-detected crossing that drives the visual flash, so audio and
 *     visuals share one source of truth. Gentler under reduced motion.
 */

const PREF_KEY = "electrico-audio";

export function AmbientAudio() {
  const audioOn = useExperience((s) => s.audioOn);
  const dimension = useExperience((s) => s.dimension);
  const lastBoundary = useExperience((s) => s.lastBoundary);
  // Last value actually seen by the persistence effect — lets us write ONLY on
  // real changes. Writing on first run would clobber a stored "on" with the
  // boot default "off" before the re-arm gesture fires (StrictMode's double
  // effect run makes a naive skip-first flag unsafe too).
  const prevOn = useRef<boolean | null>(null);

  useEffect(() => {
    setEnabled(audioOn);
    if (prevOn.current !== null && prevOn.current !== audioOn) {
      try {
        localStorage.setItem(PREF_KEY, audioOn ? "on" : "off");
      } catch {
        // Storage can be unavailable (Safari private mode) — preference just
        // won't persist; the session itself is unaffected.
      }
    }
    prevOn.current = audioOn;
  }, [audioOn]);

  useEffect(() => {
    setDimension(dimension);
  }, [dimension]);

  // Persisted-ON re-arm: the autoplay policy still requires a gesture on every
  // page load, so we can't just start the engine — we wait for the FIRST
  // pointerdown/keydown anywhere, start inside that call stack, and flip the
  // store flag (which the effect above then re-persists, harmlessly).
  useEffect(() => {
    let pref: string | null = null;
    try {
      pref = localStorage.getItem(PREF_KEY);
    } catch {
      return;
    }
    if (pref !== "on") return;
    const disarm = () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
    const arm = (e: Event) => {
      disarm();
      // The sound toggle owns its own gesture (Hud calls ensureStarted + flips
      // the flag) — auto-handling it here too would enable on pointerdown and
      // the subsequent click would toggle straight back OFF.
      const el = e.target as Element | null;
      if (el?.closest?.(".hud-sound")) return;
      ensureStarted();
      useExperience.getState().setAudioOn(true);
    };
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return disarm;
  }, []);

  // Velocity wind bridge. Asymmetric lerp: rises fast (a flick answers within
  // ~100ms), falls slow (the gust decays, doesn't cut). The soft knee maps any
  // Lenis velocity magnitude into 0..1 without calibration assumptions; under
  // reduced motion the wind keeps confirming scroll but at half strength.
  useEffect(() => {
    let raf = 0;
    let level = 0;
    const tick = () => {
      const s = useExperience.getState();
      // Only a genuine FAST flick should stir the wind — normal scrolling must
      // stay silent (it was reading as a constant fan). High divisor (110) keeps
      // medium scroll near-zero; the engine's ^2.8 curve finishes the job.
      const norm = 1 - Math.exp(-Math.abs(s.velocity) / 110);
      const target = s.reducedMotion ? norm * 0.5 : norm;
      level += (target - level) * (target > level ? 0.1 : 0.04);
      setWind(level);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Boundary stingers — `lastBoundary` is a low-frequency store value, so a
  // hook selector is correct here. The staleness guard keeps a remount (or
  // StrictMode's double effect run) from replaying an old crossing.
  useEffect(() => {
    if (!lastBoundary) return;
    if (performance.now() - lastBoundary.at > 500) return;
    playBoundaryStinger(lastBoundary.velocity, useExperience.getState().reducedMotion);
  }, [lastBoundary]);

  return null;
}
