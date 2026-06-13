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
import { clamp } from "@/src/lib/math";
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
 *  - N8AO is a Pass → conditionally MOUNTED (not .enabled-toggled): its render
 *    targets allocate VRAM at construction, so tiers that never enable AO must
 *    never construct it (phones). The pass-list rebuild on a tier change is a
 *    one-off recompile; tier changes are rare. Disposed on unmount (the wrapper
 *    doesn't do it).
 *  - DOF is an Effect → blendFunction SKIP (no pass-list churn; one brief recompile).
 *  - grain + CA disable via blend OPACITY (a uniform; instant, no recompile).
 * `quality` is low-frequency, so subscribing here is correct.
 *
 * - AO runs first (darkens crevices), then DOF, then bloom blooms the bokeh.
 * - multisampling=0: MSAA collides with bloom's mipmap downscale; SMAA stays last.
 */

const CA_OFFSET = new Vector2(0.0006, 0.0006);

// CA BOUNDARY KICK — the Igloo "falling-through" recipe: on each boundary event
// the lens fringing spikes for ~200ms and eases back to base, scaled by crossing
// speed (same envelope family as the Transitions flash, so they land together).
// Mutated via the effect ref ONLY — uniforms passed as props never see writes
// to the original object (the R3F clone gotcha applies to effects too).
const CA_BASE = 0.0006;
const CA_KICK_MS = 200;
const CA_KICK_GAIN = 9; // peak offset ≈ 0.006 — a felt lurch, not a broken frame
const CA_VELOCITY_K = 0.04; // same velocity→peak mapping as the flash

export function Effects() {
  const quality = useExperience((s) => s.quality);
  const tier = TIERS[quality];
  const aoRef = useRef<N8AOPostPass>(null);
  const dofRef = useRef<DepthOfFieldEffect>(null);

  useFrame(() => {
    // Focal plane tracks the camera's authored look-target every frame.
    const dof = dofRef.current;
    if (dof && dof.target) dof.target.copy(focusTarget);

    // CA kick: time-enveloped from the Rig's lastBoundary event, skipped under
    // reduced motion. We mutate the shared CA_OFFSET Vector2 IN PLACE rather than
    // via a component ref — the ChromaticAberrationEffect is constructed with this
    // exact Vector2 (wrapEffect passes the prop object into the constructor args by
    // reference), so writing it reaches the GPU uniform directly. We must NOT put a
    // `ref` on <ChromaticAberration>: @react-three/postprocessing's generic
    // wrapEffect is not a forwardRef, so under React 19 a ref leaks into ...props,
    // and its memo's JSON.stringify(props) then chokes on the effect instance's
    // circular scene refs ("Converting circular structure to JSON" → boundary).
    const st = useExperience.getState();
    const evt = st.lastBoundary;
    let kick = 0;
    if (evt && !st.reducedMotion) {
      const t = (performance.now() - evt.at) / CA_KICK_MS;
      if (t < 1) {
        kick = (1 - t) * (1 - t) * clamp(evt.velocity * CA_VELOCITY_K, 0.35, 1);
      }
    }
    const o = CA_BASE * (1 + kick * CA_KICK_GAIN);
    CA_OFFSET.set(o, o);
  });

  // DOF + N8AO tier gates (low-frequency, on tier change). Both gate via a
  // ref-written flag, NEVER by conditionally rendering the child: a Fragment /
  // false / null as a direct EffectComposer child corrupts its effect-grouping
  // (it builds a JSON.stringify key over the grouped pass, which then pulls in
  // the circular camera → "Converting circular structure to JSON" crash, caught
  // by ExperienceBoundary). So N8AO is ALWAYS mounted and merely `.enabled`-toggled
  // (the proven pattern); the small VRAM cost of an idle-but-allocated AO pass on
  // reduced/minimal is the deliberate price of not shipping a crash.
  useEffect(() => {
    const dof = dofRef.current;
    if (dof) dof.blendMode.blendFunction = tier.dof ? BlendFunction.NORMAL : BlendFunction.SKIP;
    const ao = aoRef.current;
    if (ao) ao.enabled = tier.ao;
  }, [tier]);

  return (
    <EffectComposer multisampling={0}>
      {/* Ambient occlusion — crevice/contact depth. FULL tier only (the prior
          44fps regression); `.enabled` is driven by the tier effect above. The
          Iris Xe seeds to `reduced`, so this pass is allocated but idle there. */}
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
      {/* placeholder removed: see the tier-gate comment above */}
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
        luminanceThreshold={0.55}
        luminanceSmoothing={0.025}
        mipmapBlur
        intensity={1.15}
        radius={0.5}
      />
      {/* A hint of lens fringing — character, not a glitch. Off below `reduced`.
          NO ref (see the useFrame comment): the boundary kick mutates CA_OFFSET
          in place, which is the effect's own offset uniform by reference. */}
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation
        modulationOffset={0.4}
        opacity={tier.ca ? 1 : 0}
      />
      {/* Cinematic grade — slight desaturate + a touch more contrast for punch. */}
      <HueSaturation saturation={0.03} />
      <BrightnessContrast brightness={-0.06} contrast={0.3} />
      {/* Fine film grain over the night base (kills flat digital banding). */}
      <Noise
        premultiply
        blendFunction={BlendFunction.OVERLAY}
        opacity={tier.grain ? 0.06 : 0}
      />
      <Vignette offset={0.4} darkness={0.92} />
      <SMAA />
    </EffectComposer>
  );
}
