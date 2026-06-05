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
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "./quality";

/**
 * Postprocessing stack — the cinematic layer (spec §5/§6). Bloom is essential
 * (the glow is what makes the energy read as *alive*); on top of it a filmic
 * grade gives the "premium render" feel: AgX tone curve (createRenderer), a
 * subtle desaturate + contrast, a whisper of chromatic aberration, fine film
 * grain. Depth of field + ambient occlusion + the LUT grade arrive in later
 * steps; they (and grain/CA) are gated by the quality tier.
 *
 * Tier gating uses each effect's blend OPACITY (a uniform applied to the existing
 * effect via R3F's `blendMode-opacity-value`) — opacity 0 disables the effect
 * with NO recreation/recompile/flash. `quality` is low-frequency, so subscribing
 * via the hook selector here is correct (a handful of re-renders per session).
 *
 * - multisampling=0: MSAA collides with bloom's mipmap downscale; SMAA does the
 *   edge cleanup as a post pass and MUST stay last.
 */

const CA_OFFSET = new Vector2(0.0006, 0.0006);

export function Effects() {
  const quality = useExperience((s) => s.quality);
  const tier = TIERS[quality];

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
      {/* A hint of lens fringing — character, not a glitch. Off below `reduced`. */}
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation
        modulationOffset={0.4}
        opacity={tier.ca ? 1 : 0}
      />
      {/* Cinematic grade — slight desaturate + a touch more contrast for punch. */}
      <HueSaturation saturation={-0.06} />
      <BrightnessContrast brightness={-0.02} contrast={0.15} />
      {/* Fine film grain over the night base (kills flat digital banding). */}
      <Noise
        premultiply
        blendFunction={BlendFunction.OVERLAY}
        opacity={tier.grain ? 0.06 : 0}
      />
      <Vignette offset={0.3} darkness={0.72} />
      <SMAA />
    </EffectComposer>
  );
}
