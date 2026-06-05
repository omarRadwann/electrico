import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  ChromaticAberration,
  Noise,
  SMAA,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2 } from "three";

/**
 * Postprocessing stack — the cinematic layer (spec §5/§6). Bloom is essential
 * (the glow is what makes the energy read as *alive*); on top of it a filmic
 * grade gives the "premium render" feel: AgX tone curve (in createRenderer),
 * a subtle desaturate + contrast, a whisper of chromatic aberration for lens
 * character, and fine film grain that breaks up the flat dark gradients (kills
 * the digital-clean banding tell).
 *
 * - multisampling=0: MSAA collides with bloom's mipmap downscale; SMAA does the
 *   edge cleanup as a post pass and MUST stay last.
 * - Depth of field, ambient occlusion, and the LUT grade arrive in later steps,
 *   gated behind the quality tiers.
 */

// Fixed CA offset — module scope so it's not reallocated each render.
const CA_OFFSET = new Vector2(0.0006, 0.0006);

export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      {/* Bright-only bloom — only true light sources glow, not the whole frame. */}
      <Bloom
        luminanceThreshold={0.42}
        luminanceSmoothing={0.07}
        mipmapBlur
        intensity={1.0}
        radius={0.62}
      />
      {/* A hint of lens fringing at the edges — character, not a glitch. */}
      <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.4} />
      {/* Cinematic grade — slight desaturate + a touch more contrast for punch. */}
      <HueSaturation saturation={-0.06} />
      <BrightnessContrast brightness={-0.02} contrast={0.15} />
      {/* Fine film grain — overlays the night base so dark gradients read as film
          stock instead of flat digital banding. Subtle (low opacity). */}
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.06} />
      <Vignette offset={0.3} darkness={0.72} />
      <SMAA />
    </EffectComposer>
  );
}
