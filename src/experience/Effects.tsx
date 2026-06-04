import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
} from "@react-three/postprocessing";

/**
 * Postprocessing stack (spec §5/§6: bloom is essential — the glow is what makes
 * the energy read as *alive*). WebGL2 + the pmndrs postprocessing stack is the
 * supported pairing (never WebGPU — spec §5.1).
 *
 * - multisampling=0: MSAA collides with bloom's mipmap downscale.
 * - luminanceThreshold ~0.9 with ACES tone-mapping + `toneMapped={false}`
 *   emissives: only the bright glowing bits bloom, not the whole frame.
 * Quality tiers (lower/disable bloom on low-end devices) arrive in M7.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      {/* NOTE: tried N8AO (contact AO) here — dropped fps 67->44 on the target
          integrated GPU (Intel Iris Xe), violating the 60fps gate. The env IBL
          already supplies material depth; revisit AO only with a heavy quality
          dial-down or for higher-tier devices (M7). */}
      {/* threshold nudged to 0.25 so env-lit (non-emissive) surfaces don't bloom. */}
      <Bloom
        luminanceThreshold={0.25}
        luminanceSmoothing={0.08}
        mipmapBlur
        intensity={1.25}
        radius={0.8}
      />
      {/* Subtle cinematic grade — slight desaturate + a touch of contrast. */}
      <HueSaturation saturation={-0.08} />
      <BrightnessContrast brightness={0} contrast={0.06} />
      <Vignette offset={0.3} darkness={0.72} />
    </EffectComposer>
  );
}
