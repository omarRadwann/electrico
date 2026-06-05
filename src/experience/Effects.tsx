import {
  EffectComposer,
  N8AO,
  DepthOfField,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  ChromaticAberration,
  Noise,
  SMAA,
} from "@react-three/postprocessing";
import { BlendFunction, DepthOfFieldEffect } from "postprocessing";
import type { N8AOPostPass } from "n8ao";
import { Vector2 } from "three";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "./quality";
import { focusTarget } from "./cameraPath";

/**
 * Postprocessing stack — the cinematic layer (spec §5/§6). Bloom is essential
 * (the glow is what makes the energy read as *alive*); on top of it a filmic
 * grade (AgX in createRenderer + this chain): ambient occlusion for crevice depth,
 * depth-of-field focus on the framed subject, a subtle desaturate + contrast, a
 * whisper of chromatic aberration, fine film grain.
 *
 * Tier gating without remounting the composer (which would flash):
 *  - N8AO is a Pass → toggle `.enabled` (composer skips a disabled pass; no cost).
 *  - DOF is an Effect → blendFunction SKIP (no pass-list churn; one brief recompile).
 *  - grain + CA disable via blend OPACITY (a uniform; instant, no recompile).
 * `quality` is low-frequency, so subscribing here is correct.
 *
 * - AO runs first (darkens crevices), then DOF, then bloom blooms the bokeh.
 * - multisampling=0: MSAA collides with bloom's mipmap downscale; SMAA stays last.
 */

const CA_OFFSET = new Vector2(0.0006, 0.0006);

export function Effects() {
  const quality = useExperience((s) => s.quality);
  const tier = TIERS[quality];
  const aoRef = useRef<N8AOPostPass>(null);
  const dofRef = useRef<DepthOfFieldEffect>(null);

  // Focal plane tracks the camera's authored look-target every frame.
  useFrame(() => {
    const dof = dofRef.current;
    if (dof && dof.target) dof.target.copy(focusTarget);
  });

  // Apply tier gates for the expensive passes (low-frequency, on tier change).
  useEffect(() => {
    if (aoRef.current) aoRef.current.enabled = tier.ao;
    const dof = dofRef.current;
    if (dof) dof.blendMode.blendFunction = tier.dof ? BlendFunction.NORMAL : BlendFunction.SKIP;
  }, [tier]);

  return (
    <EffectComposer multisampling={0}>
      {/* Ambient occlusion — crevice/contact depth. FULL tier only (the prior
          44fps regression); these low-cost params + halfRes are the gate. The
          Iris Xe seeds to `reduced`, so this pass is disabled there by default. */}
      <N8AO
        ref={aoRef}
        halfRes
        quality="low"
        aoSamples={8}
        denoiseSamples={4}
        denoiseRadius={6}
        aoRadius={1.6}
        distanceFalloff={0.8}
        intensity={1.1}
        color="#05070d"
      />
      {/* Cinematic focus — the framed subject is sharp, foreground/far fall to
          bokeh. resolutionScale 0.5: the bokeh blur is the cost. */}
      <DepthOfField
        ref={dofRef}
        target={focusTarget}
        worldFocusRange={11}
        bokehScale={2.2}
        resolutionScale={0.5}
      />
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
