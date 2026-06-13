"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useExperience, type QualityTier } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";

/**
 * Adaptive quality tiers (spec §8 / M7). The cinematic effects (DOF, AO) are too
 * heavy for weak/integrated GPUs at 60fps, so we auto-detect a tier at boot from
 * the GPU string and live-downgrade under sustained load. Every gated knob lives
 * in TIERS so effects + scenes read one object. `reducedMotion` hard-pins minimal.
 */

export interface TierConfig {
  dprMax: number;
  dof: boolean;
  /** N8AO is conditionally MOUNTED on this flag (not just .enabled-toggled) —
   *  its render targets allocate VRAM at construction, which phones never get back. */
  ao: boolean;
  grain: boolean;
  ca: boolean;
  /** MeshReflectorMaterial resolution; 0 disables the reflective ground. */
  reflectorRes: number;
  shadowMapSize: number;
  /** Environment IBL intensity — high enough that the Lightformer speculars and
   *  the tiling surface maps actually MODEL surfaces (the old 0.16/0.14/0.11
   *  starved the IBL into invisibility once emissives stopped carrying frames). */
  envIntensity: number;
  /** Texture anisotropy, wired through useSurfaceMaps (was a dead knob). */
  anisotropy: number;
  /** Silhouette-critical iconography (substations, pylons, work lights) — ON for
   *  EVERY tier. Minimal means simpler-premium, not empty: these are what make
   *  each dimension READ as its service. */
  props: boolean;
  /** Expensive extras — shadow-casting work lights, secondary particle layer,
   *  power-line tubes, blueprint edge-glow (full tier only). */
  heavyProps: boolean;
}

export const TIERS: Record<QualityTier, TierConfig> = {
  full: { dprMax: 2, dof: true, ao: true, grain: true, ca: true, reflectorRes: 96, shadowMapSize: 1024, envIntensity: 0.34, anisotropy: 8, props: true, heavyProps: true },
  reduced: { dprMax: 1.5, dof: true, ao: false, grain: true, ca: true, reflectorRes: 0, shadowMapSize: 512, envIntensity: 0.3, anisotropy: 4, props: true, heavyProps: false },
  minimal: { dprMax: 1, dof: false, ao: false, grain: false, ca: false, reflectorRes: 0, shadowMapSize: 512, envIntensity: 0.24, anisotropy: 1, props: true, heavyProps: false },
};

const ORDER: QualityTier[] = ["minimal", "reduced", "full"];

/** Seed the tier from the GPU renderer string (before any heavy effect mounts). */
function seedFromGPU(name: string | null): QualityTier {
  if (!name) return "reduced";
  const r = name.toLowerCase();
  // Safari (macOS 15+ AND all iOS) masks the renderer to literally "Apple GPU" —
  // the string alone is NOT a mobile signal: an M3 Max in Safari reports the
  // same as an iPhone. Disambiguate with form-factor signals: a non-touch,
  // non-mobile-UA device claiming "Apple GPU" is desktop Apple silicon → full.
  // (iPadOS masquerades as "Macintosh" in its UA but exposes maxTouchPoints > 0,
  // so the touch check still routes genuine tablets to the mobile branch.)
  if (/apple gpu/.test(r)) {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0;
    if (!/iphone|ipad|android/i.test(ua) && touchPoints === 0) return "full";
    return "minimal"; // genuine iPhone/iPad — keep the conservative mobile floor
  }
  if (/apple m\d|nvidia|rtx|geforce|radeon|\brx\s?\d/.test(r)) return "full";
  if (/intel|iris|uhd|hd graphics/.test(r)) return "reduced"; // Iris Xe lands here → protects the 60fps floor
  if (/mali|adreno|powervr/.test(r)) return "minimal";
  return "reduced";
}

/**
 * Mounted inside <Canvas>. Boot-seeds the tier, sets DPR per tier, mirrors
 * prefers-reduced-motion (pinning minimal), and live-DOWNGRADES via drei's
 * PerformanceMonitor when fps sustains below ~50 (never auto-upgrades past the
 * GPU seed — the seed is the safe ceiling; monitoring only protects the floor).
 */
export function QualityController() {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const quality = useExperience((s) => s.quality);

  // Boot seed (once).
  useEffect(() => {
    const st = useExperience.getState();
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      st.setReducedMotion(true);
      st.setQuality("minimal");
      return;
    }
    let name: string | null = null;
    try {
      const ctx = gl.getContext();
      const ext = ctx.getExtension("WEBGL_debug_renderer_info");
      name = ext ? (ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : null;
    } catch {
      /* renderer string unavailable → safe default below */
    }
    st.setQuality(seedFromGPU(name));
  }, [gl]);

  // DPR follows the tier.
  useEffect(() => {
    const cap = TIERS[quality].dprMax;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    setDpr(Math.min(dpr, cap));
  }, [quality, setDpr]);

  // Live prefers-reduced-motion → pin minimal.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      const st = useExperience.getState();
      st.setReducedMotion(mq.matches);
      if (mq.matches) st.setQuality("minimal");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <PerformanceMonitor
      bounds={(refresh) => [50, Math.max(60, refresh)]}
      onDecline={() => {
        const st = useExperience.getState();
        if (st.reducedMotion) return;
        const i = ORDER.indexOf(st.quality);
        if (i > 0) st.setQuality(ORDER[i - 1]);
      }}
      onChange={({ factor }) => {
        // BETWEEN-TIER FRACTIONAL DPR: degradation is a slope, not three cliffs.
        // PerformanceMonitor's factor boots at 0.5 (neutral) and can never rise
        // far on displays already pinned at their refresh rate — so factor ≥ 0.5
        // maps to the tier's FULL cap (healthy machines are never degraded by
        // the monitor merely existing), and only below-neutral factors slide
        // DPR linearly toward the hard 1.0 floor before the next tier cliff.
        const st = useExperience.getState();
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
        const cap = Math.min(dpr, TIERS[st.quality].dprMax);
        const slope = clamp(factor / 0.5, 0, 1);
        setDpr(clamp(1 + (cap - 1) * slope, 1, cap));
      }}
    />
  );
}
