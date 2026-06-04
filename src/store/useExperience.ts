import { create } from "zustand";

export type QualityTier = "full" | "reduced" | "minimal";

/**
 * Global experience state (spec §4): one small store for low-frequency flags
 * plus the smoothed scroll value Lenis writes every frame.
 *
 * PER-FRAME DISCIPLINE (spec §4 / §10): `scroll`, `progress` and `velocity`
 * change every animation frame. Consumers inside `useFrame` MUST read them with
 * `useExperience.getState()` — never the hook selector — so the render loop
 * triggers no React re-renders. Subscribe via the hook only for the
 * low-frequency values (dimension, audioOn, quality...).
 */
interface ExperienceState {
  // High-frequency — read via getState() inside useFrame, do not subscribe.
  scroll: number; // smoothed scroll offset in px (from Lenis)
  progress: number; // normalized 0..1 across the whole dive
  velocity: number; // Lenis scroll velocity (drives motion cues later)

  // Low-frequency — safe to subscribe to.
  dimension: number; // active dimension index 0..5
  audioOn: boolean;
  quality: QualityTier;
  loadProgress: number; // 0..1 asset loading
  reducedMotion: boolean;

  // Actions
  setScroll: (scroll: number, progress: number, velocity: number) => void;
  setDimension: (dimension: number) => void;
  setAudioOn: (audioOn: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  setLoadProgress: (loadProgress: number) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
}

export const useExperience = create<ExperienceState>()((set) => ({
  scroll: 0,
  progress: 0,
  velocity: 0,
  dimension: 0,
  audioOn: false,
  quality: "full",
  loadProgress: 0,
  reducedMotion: false,

  setScroll: (scroll, progress, velocity) => set({ scroll, progress, velocity }),
  setDimension: (dimension) => set({ dimension }),
  setAudioOn: (audioOn) => set({ audioOn }),
  setQuality: (quality) => set({ quality }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));

// Dev-only: expose the store so a real (non-hidden) browser can drive and assert
// the experience, since the headless preview tab freezes requestAnimationFrame.
// `process.env.NODE_ENV` is inlined at build time, so this is dead-code-stripped
// from production bundles.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __experience?: typeof useExperience }).__experience =
    useExperience;
}
