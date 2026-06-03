import { create } from "zustand";

export type QualityTier = "full" | "reduced" | "minimal";

/**
 * Global experience state (spec §4): one small store for low-frequency flags
 * plus the smoothed scroll value Lenis writes every frame.
 *
 * PER-FRAME DISCIPLINE (spec §4 / §10): `scroll`, `progress` and `velocity`
 * change on every animation frame. Consumers inside `useFrame` MUST read them
 * with the non-reactive getter `useExperience.getState().progress` — never the
 * hook selector — so the render loop never triggers React re-renders. Subscribe
 * via the hook (selector) only for the low-frequency values below.
 */
interface ExperienceState {
  // High-frequency — read via getState() inside useFrame, do not subscribe.
  scroll: number; // smoothed scroll offset in px (from Lenis)
  progress: number; // normalized 0..1 across the whole dive
  velocity: number; // Lenis scroll velocity (drives motion cues later)

  // Low-frequency — safe to subscribe to.
  audioOn: boolean;
  quality: QualityTier;
  loadProgress: number; // 0..1 asset loading
  reducedMotion: boolean;

  // Actions
  setScroll: (scroll: number, progress: number, velocity: number) => void;
  setAudioOn: (audioOn: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  setLoadProgress: (loadProgress: number) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
}

export const useExperience = create<ExperienceState>()((set) => ({
  scroll: 0,
  progress: 0,
  velocity: 0,
  audioOn: false,
  quality: "full",
  loadProgress: 0,
  reducedMotion: false,

  setScroll: (scroll, progress, velocity) => set({ scroll, progress, velocity }),
  setAudioOn: (audioOn) => set({ audioOn }),
  setQuality: (quality) => set({ quality }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
