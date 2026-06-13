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
  // LIBRARY-BOUNDARY GOTCHA (verified in @react-three/fiber 9.6 dist): R3F's
  // configure() runs AFTER this factory returns and OVERRIDES two settings —
  //   - toneMapping → ACESFilmic (no `flat` prop on <Canvas>), and
  //   - shadowMap.enabled/type → from the Canvas `shadows` prop.
  // The values below are therefore the factory's *intent*, re-asserted in the
  // Canvas `onCreated` callback (Experience.tsx), which runs after configure().
  // Keep both in sync: this factory stays correct standalone (outside R3F), and
  // onCreated makes it correct inside R3F.
  //
  // AgX (three r160+) gives a more filmic, gently-desaturated highlight rolloff
  // than ACES — the modern "premium render" curve. It only shapes NON-emissive
  // surfaces; the glow materials are `toneMapped:false`, so the amber/teal/copper
  // light sources stay punchy and bloom as tuned. (sRGB OETF still applied at
  // output — tone curve and colour-space encode are separate stages.)
  renderer.toneMapping = THREE.AgXToneMapping;
  // Pull AgX mid-tones down so the night base reads genuinely deep instead of
  // milky. Emissive materials are toneMapped:false, so the window/steel/copper
  // light sources bypass this and pop HARDER against the darker base. Cheapest
  // single de-wash lever.
  renderer.toneMappingExposure = 0.8;
  // Soft shadow maps, used selectively (only the Room's lamp casts) for grounded
  // realism without the cost of shadowing all six dimensions. Inside R3F this is
  // only LIVE because <Canvas shadows> is set — configure() does
  // `shadowMap.enabled = !!shadows` and would dead-switch it otherwise.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}
