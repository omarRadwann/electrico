import { create } from "zustand";

export type QualityTier = "full" | "reduced" | "minimal";

/** A boundary-crossing event (dimension threshold passed by the damped camera). */
export interface BoundaryEvent {
  /** Boundary index 0..4 (between dimension i and i+1). */
  index: number;
  /** performance.now() timestamp of the crossing. */
  at: number;
  /** |scroll velocity| at the crossing — scales flash/audio impact. */
  velocity: number;
  /** +1 diving deeper, -1 scrolling back. */
  direction: 1 | -1;
}

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
  /** True once the visitor has reached the end of the dive at least once —
   * arms the loop veil in both directions and unlocks backward wrapping. */
  completedOnce: boolean;
  /** Last boundary crossing, written by the Rig (edge-detected on the damped
   * progress). Subscribe for one-shots (audio stingers); the visual flash reads
   * it via getState() in useFrame. */
  lastBoundary: BoundaryEvent | null;
  /** Contact terminal overlay (the conversion surface — lives above the veil). */
  terminalOpen: boolean;

  // Actions
  setScroll: (scroll: number, progress: number, velocity: number) => void;
  setDimension: (dimension: number) => void;
  setAudioOn: (audioOn: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  setLoadProgress: (loadProgress: number) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setCompletedOnce: (completedOnce: boolean) => void;
  setLastBoundary: (lastBoundary: BoundaryEvent) => void;
  setTerminalOpen: (terminalOpen: boolean) => void;
}

export const useExperience = create<ExperienceState>()((set) => ({
  scroll: 0,
  progress: 0,
  velocity: 0,
  dimension: 0,
  audioOn: false,
  // Boot on the middle tier: the GPU seed (quality.tsx) only ever confirms or
  // moves it. Defaulting to "full" made the first frames on weak phones mount
  // the full post stack exactly when the device is busiest.
  quality: "reduced",
  loadProgress: 0,
  reducedMotion: false,
  completedOnce: false,
  lastBoundary: null,
  terminalOpen: false,

  setScroll: (scroll, progress, velocity) => set({ scroll, progress, velocity }),
  setDimension: (dimension) => set({ dimension }),
  setAudioOn: (audioOn) => set({ audioOn }),
  setQuality: (quality) => set({ quality }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setCompletedOnce: (completedOnce) => set({ completedOnce }),
  setLastBoundary: (lastBoundary) => set({ lastBoundary }),
  setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
}));

/**
 * Imperative scroll-navigation channel: useSmoothScroll registers a handler
 * that maps a dive progress (0..1) onto Lenis' scroll range; UI (HUD rail
 * ticks, skip controls) calls scrollToProgress without touching Lenis directly.
 * No-ops safely before Lenis mounts.
 */
type ScrollToProgress = (p: number, immediate?: boolean) => void;
let scrollHandler: ScrollToProgress | null = null;
export function registerScrollToProgress(fn: ScrollToProgress | null): void {
  scrollHandler = fn;
}
export function scrollToProgress(p: number, immediate = false): void {
  scrollHandler?.(p, immediate);
}

// Dev-only: expose the store so a real (non-hidden) browser can drive and assert
// the experience, since the headless preview tab freezes requestAnimationFrame.
// `process.env.NODE_ENV` is inlined at build time, so this is dead-code-stripped
// from production bundles.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __experience?: typeof useExperience }).__experience =
    useExperience;
}
