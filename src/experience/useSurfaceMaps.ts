"use client";

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "@/src/experience/quality";

/**
 * Load a tiling normal + roughness map pair for a procedural surface and configure
 * it (repeat wrap, anisotropy). The maps are DATA — left in linear colour space
 * (never sRGB). They add micro-relief + specular variation so steel/concrete catch
 * the light, WITHOUT an albedo map (the dark night `color` is preserved).
 *
 * Anisotropy follows the quality tier (8/4/1) — it was declared in TIERS but
 * hardcoded to 4 here, making the knob dead. `quality` is low-frequency, so the
 * hook subscription is correct; the textures re-configure on a tier change
 * without reloading (only the sampler params change).
 *
 * Suspends while loading, so the caller must sit under a <Suspense> boundary.
 */
export function useSurfaceMaps(
  normalUrl: string,
  roughUrl: string,
  repeatX = 2,
  repeatY = 2,
) {
  const gl = useThree((s) => s.gl);
  const quality = useExperience((s) => s.quality);
  const maps = useTexture({ normalMap: normalUrl, roughnessMap: roughUrl });
  useLayoutEffect(() => {
    // Clamp to hardware: full tier asks for 8, but some GPUs cap lower.
    const anisotropy = Math.min(
      TIERS[quality].anisotropy,
      gl.capabilities.getMaxAnisotropy(),
    );
    for (const t of [maps.normalMap, maps.roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = anisotropy;
      t.needsUpdate = true;
    }
  }, [maps, repeatX, repeatY, quality, gl]);
  return maps;
}
