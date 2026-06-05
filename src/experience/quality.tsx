"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useExperience, type QualityTier } from "@/src/store/useExperience";

/**
 * Adaptive quality tiers (spec §8 / M7). The cinematic effects (DOF, AO) are too
 * heavy for weak/integrated GPUs at 60fps, so we auto-detect a tier at boot from
 * the GPU string and live-downgrade under sustained load. Every gated knob lives
 * in TIERS so effects + scenes read one object. `reducedMotion` hard-pins minimal.
 */

export interface TierConfig {
  dprMax: number;
  dof: boolean;
  ao: boolean;
  grain: boolean;
  ca: boolean;
  lut: boolean;
  /** MeshReflectorMaterial resolution; 0 disables the reflective ground. */
  reflectorRes: number;
  shadowMapSize: number;
  /** Environment IBL intensity (Lightformers need ~0.5 to register). */
  envIntensity: number;
  anisotropy: number;
}

export const TIERS: Record<QualityTier, TierConfig> = {
  full: { dprMax: 2, dof: true, ao: true, grain: true, ca: true, lut: true, reflectorRes: 128, shadowMapSize: 1024, envIntensity: 0.42, anisotropy: 8 },
  reduced: { dprMax: 1.5, dof: true, ao: false, grain: true, ca: true, lut: false, reflectorRes: 64, shadowMapSize: 512, envIntensity: 0.38, anisotropy: 4 },
  minimal: { dprMax: 1, dof: false, ao: false, grain: false, ca: false, lut: false, reflectorRes: 0, shadowMapSize: 512, envIntensity: 0.3, anisotropy: 1 },
};

const ORDER: QualityTier[] = ["minimal", "reduced", "full"];

/** Seed the tier from the GPU renderer string (before any heavy effect mounts). */
function seedFromGPU(name: string | null): QualityTier {
  if (!name) return "reduced";
  const r = name.toLowerCase();
  if (/apple m\d|nvidia|rtx|geforce|radeon|\brx\s?\d/.test(r)) return "full";
  if (/intel|iris|uhd|hd graphics/.test(r)) return "reduced"; // Iris Xe lands here → protects the 60fps floor
  if (/mali|adreno|powervr|apple gpu/.test(r)) return "minimal";
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
    />
  );
}
