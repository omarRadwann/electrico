import * as THREE from "three";

/**
 * Single source of truth for renderer creation (spec §5.1).
 *
 * v1 ships the battle-tested WebGL2 renderer because the postprocessing stack
 * this site depends on (bloom, DOF, the render-target transition passes) is
 * most mature there. Swapping to three/webgpu's WebGPURenderer is intended to
 * be a one-file change confined to this module.
 *
 * NOTE ON THE SIGNATURE: R3F v9 calls this factory with its `DefaultGLProps` —
 * the `WebGLRenderer` parameters *including the canvas R3F already created* — so
 * we spread `props` in rather than constructing our own canvas. (The brief's
 * `(canvas) => ...` snippet predates v9; corrected against the installed types
 * in @react-three/fiber: `GLProps = ((defaultProps: DefaultGLProps) => Renderer)`.)
 */
export function createRenderer(
  props: THREE.WebGLRendererParameters,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    ...props,
    antialias: true,
    powerPreference: "high-performance",
    alpha: false,
  });

  // Cap DPR at 2 — pixels past 2x are invisible cost on retina (perf §8.1).
  // R3F also clamps this via the Canvas `dpr={[1, 2]}` prop; setting it here
  // keeps the factory correct if ever used outside R3F.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Soft shadow maps, used selectively (only the Room's lamp casts) for grounded
  // realism without the cost of shadowing all six dimensions.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}
