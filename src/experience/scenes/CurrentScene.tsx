import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { smoothstep } from "@/src/lib/math";
import {
  GROUP_POSITION,
  LINE_FRAG,
  LINE_VERT,
  POINT_FRAG,
  POINT_VERT,
  buildCurrentAssets,
  makeCurrentUniforms,
} from "./currentFilaments";

/**
 * Dimension 6 — The Live Current (spec §7): the climax + loop hand-off. The camera
 * parks at the final keyframe staring straight into this scene, then the dive wraps
 * back to the City — so this is where the polish budget lands (briefing §17 P8).
 *
 * Verb: FLOW, now actually alive. Two harmonics of STREAKING CURRENT — each is a
 * point-head layer (bloom cores) + a LineSegments filament layer whose tails are the
 * same flow path evaluated at a lagged phase, so streaks bend along their real
 * trajectory and lengthen with flow speed. Flow speed couples to scroll velocity:
 * flick the wheel and the current surges. As progress crosses 0.93 → ~0.99 the
 * particles peel out of the flow field into a seeded skyline-window formation in
 * CityScene's window amber — "the current becomes the city's light" — the match-cut
 * the LoopVeil then wraps into the real City.
 *
 * P0 HISTORY (do not regress): this scene used to mutate module-scope uniform
 * objects in useFrame, but R3F v9 CLONES the object passed to
 * `<shaderMaterial uniforms={…}>` — the GPU never saw the writes and both particle
 * systems froze at t=0. ALL per-frame uniform writes now go through material refs
 * (`mat.uniforms.X.value`); the module objects only seed initial values.
 */

// --- Flow tuning (module scope — no per-frame allocation, no magic inline) ------

/** Base flow phase speed (z-speed spreads 1..2× per particle ⇒ ≈9..18 u/s, the authored pace). */
const FLOW_BASE = 9;
/** px/frame → phase-speed gain. Lenis velocity is px/FRAME (verified in lenis dist). */
const FLOW_GAIN = 0.3;
/** Velocity clamp: a violent flick tops out at ~4× base speed, never a white smear. */
const VEL_CLAMP = 90;
/** Swirl/drift phase speed: slow base + mild coupling so braiding quickens with flow. */
const SWIRL_BASE = 0.45;
const SWIRL_GAIN = 0.012;
/** Streak length: tail phase-lag ∝ flow speed (base ≈0.8..1.6 u, surge ≈3..6.5 u). */
const TAIL_GAIN = 0.09;
/**
 * Match-cut ramp: starts AT the climax park (last park key = 0.93) and completes at
 * 0.99 — just before the LoopVeil reaches full opacity at 1.0 — so the settled
 * skyline is SEEN through the part-veil instead of finishing behind black.
 */
const FORM_START = 0.93;
const FORM_END = 0.99;

// Uniform seeds (initial values only — R3F clones these into each material; the
// live objects are reached exclusively via refs in useFrame). Primary keeps the
// amber power current; secondary is the electric white-teal harmonic; BOTH settle
// to CityScene's WIN_COLOR (#ffb24d) so the match-cut lands on the city's exact amber.
const PRIMARY_UNIFORMS = makeCurrentUniforms("#ffae3a", "#ffb24d", 1);
const SECONDARY_UNIFORMS = makeCurrentUniforms("#7fd8e8", "#ffb24d", 0.45);

// Radial discharge arcs — bright blue-white bolts flaring from the core outward.
// Math.random placement is acceptable here: arcs extend ≤ ~3.3 in z from the core
// while the camera never comes closer than local z = +8 (no path intersection).
const ARC_COUNT = 12;
const ARC_COL = new THREE.Color("#bfe6ff");
const _ad = new THREE.Object3D();
const _ac = new THREE.Color();
const _adir = new THREE.Vector3();
const _aq = new THREE.Quaternion();
const _aY = new THREE.Vector3(0, 1, 0);

export function CurrentScene() {
  const coreRef = useRef<THREE.Mesh>(null);
  const arcsRef = useRef<THREE.InstancedMesh>(null);
  const arcBright = useRef<number[]>([]);

  // The four flow materials (primary/secondary × points/lines). Refs are the ONLY
  // route to the GPU-bound uniforms (R3F clones the `uniforms` prop — see header).
  const flowMats = useRef<(THREE.ShaderMaterial | null)[]>([null, null, null, null]);
  // CPU-integrated phases + damped speed (module-scope-style refs; no setState here).
  const flowPhase = useRef(0);
  const swirlPhase = useRef(0);
  const flowSpeed = useRef(FLOW_BASE);

  // Tier-scaled particle counts. Subscribed (low-frequency, hook-safe) rather than
  // read-once: the GPU seed lands in a QualityController effect AFTER first mount
  // (boot default is 'reduced'), so a mount-time read would pin full-tier machines
  // at 0.5× forever. Rebuild is a rare one-off; old geometries are disposed so
  // renderer.info.memory stays flat.
  const quality = useExperience((s) => s.quality);
  const assets = useMemo(() => buildCurrentAssets(quality), [quality]);
  useEffect(() => () => assets.dispose(), [assets]);

  useLayoutEffect(() => {
    const m = arcsRef.current;
    if (!m) return;
    const b: number[] = [];
    for (let i = 0; i < ARC_COUNT; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      _adir.set(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph) * 0.5).normalize();
      const len = 4 + Math.random() * 2.5;
      _aq.setFromUnitVectors(_aY, _adir);
      _ad.position.copy(_adir).multiplyScalar(len / 2);
      _ad.quaternion.copy(_aq);
      _ad.scale.set(0.06, len, 0.06);
      _ad.updateMatrix();
      m.setMatrixAt(i, _ad.matrix);
      _ac.setRGB(0, 0, 0);
      m.setColorAt(i, _ac);
      b.push(Math.random());
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    arcBright.current = b;
  }, []);

  useFrame((state, dt) => {
    const st = useExperience.getState();

    // FLOW ← SCROLL VELOCITY: damped toward base + k·|velocity| so a flick SURGES
    // the current and decays smoothly. Integrating PHASE (not speed×time in the
    // shader) means speed changes alter the derivative, never the position.
    const vel = Math.min(Math.abs(st.velocity), VEL_CLAMP);
    flowSpeed.current = THREE.MathUtils.damp(flowSpeed.current, FLOW_BASE + vel * FLOW_GAIN, 2.5, dt);
    flowPhase.current += dt * flowSpeed.current;
    swirlPhase.current += dt * (SWIRL_BASE + flowSpeed.current * SWIRL_GAIN);

    const lag = flowSpeed.current * TAIL_GAIN;
    const form = smoothstep(FORM_START, FORM_END, st.progress);
    // DPR compensation for gl_PointSize (device px): read the renderer's live ratio
    // every frame — the QualityController retargets DPR on tier changes.
    const dpr = state.gl.getPixelRatio();

    // VERIFY-BY-MATH: vertex output is uFlow/uSwirl-dependent (flowPos), and both
    // integrate dt through the material refs below — the cloned, GPU-bound uniform
    // objects — so a frozen field is structurally impossible again.
    const mats = flowMats.current;
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m) continue;
      m.uniforms.uFlow.value = flowPhase.current;
      m.uniforms.uSwirl.value = swirlPhase.current;
      m.uniforms.uTailLag.value = lag;
      m.uniforms.uForm.value = form;
      m.uniforms.uDpr.value = dpr;
    }

    // Living core pulse — clock-driven (the old module uTime accumulator is gone).
    const t = state.clock.elapsedTime;
    const core = coreRef.current;
    if (core) core.scale.setScalar(1.1 + 0.4 * Math.sin(t * 2.2) + 0.18 * Math.sin(t * 6.1));

    // Discharge arcs flare + fade at random (electrical discharge from the core).
    const m = arcsRef.current;
    if (m && m.instanceColor) {
      const b = arcBright.current;
      for (let i = 0; i < b.length; i++) {
        b[i] -= dt * 2.5;
        if (b[i] < 0) b[i] = Math.random() < 0.5 ? 1.4 + Math.random() * 1.6 : 0;
        _ac.copy(ARC_COL).multiplyScalar(Math.max(0, b[i]));
        m.setColorAt(i, _ac);
      }
      m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={GROUP_POSITION}>
      {/* Primary warm stream — filament streaks + bloom point heads. Additive +
          depthWrite:false keeps the four layers order-independent. */}
      <lineSegments geometry={assets.primaryLines}>
        <shaderMaterial
          ref={(mat: THREE.ShaderMaterial | null) => {
            flowMats.current[0] = mat;
          }}
          vertexShader={LINE_VERT}
          fragmentShader={LINE_FRAG}
          uniforms={PRIMARY_UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points geometry={assets.primaryPoints}>
        <shaderMaterial
          ref={(mat: THREE.ShaderMaterial | null) => {
            flowMats.current[1] = mat;
          }}
          vertexShader={POINT_VERT}
          fragmentShader={POINT_FRAG}
          uniforms={PRIMARY_UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Secondary electric white-teal harmonic — slower (uRate 0.45), tighter,
          behind the warm flow: depth + rhythm. */}
      <lineSegments geometry={assets.secondaryLines}>
        <shaderMaterial
          ref={(mat: THREE.ShaderMaterial | null) => {
            flowMats.current[2] = mat;
          }}
          vertexShader={LINE_VERT}
          fragmentShader={LINE_FRAG}
          uniforms={SECONDARY_UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points geometry={assets.secondaryPoints}>
        <shaderMaterial
          ref={(mat: THREE.ShaderMaterial | null) => {
            flowMats.current[3] = mat;
          }}
          vertexShader={POINT_VERT}
          fragmentShader={POINT_FRAG}
          uniforms={SECONDARY_UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Living core — a bright pulsing heart the filaments stream from.
          toneMapped:false is correct: pure-glow meshBasicMaterial light source. */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.2, 24, 24]} />
        <meshBasicMaterial
          color="#ffd98a"
          toneMapped={false}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Radial discharge arcs — electric bolts flaring from the core outward.
          toneMapped:false correct here too (pure-glow basic material). */}
      <instancedMesh ref={arcsRef} args={[undefined, undefined, ARC_COUNT]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
