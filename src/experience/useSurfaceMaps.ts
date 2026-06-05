"use client";

import { useLayoutEffect } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/**
 * Load a tiling normal + roughness map pair for a procedural surface and configure
 * it (repeat wrap, anisotropy). The maps are DATA — left in linear colour space
 * (never sRGB). They add micro-relief + specular variation so steel/concrete catch
 * the light, WITHOUT an albedo map (the dark night `color` is preserved).
 *
 * Suspends while loading, so the caller must sit under a <Suspense> boundary.
 */
export function useSurfaceMaps(
  normalUrl: string,
  roughUrl: string,
  repeatX = 2,
  repeatY = 2,
) {
  const maps = useTexture({ normalMap: normalUrl, roughnessMap: roughUrl });
  useLayoutEffect(() => {
    for (const t of [maps.normalMap, maps.roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 4;
      t.needsUpdate = true;
    }
  }, [maps, repeatX, repeatY]);
  return maps;
}
