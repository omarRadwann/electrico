import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

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
      <Bloom
        luminanceThreshold={0.2}
        luminanceSmoothing={0.08}
        mipmapBlur
        intensity={1.3}
        radius={0.8}
      />
      <Vignette offset={0.28} darkness={0.7} />
    </EffectComposer>
  );
}
