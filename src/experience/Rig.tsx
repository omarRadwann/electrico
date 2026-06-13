import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";
import {
  sampleCamera,
  focusTarget,
  ZONE_PROGRESS,
  BOUNDARY_PROGRESS,
  boundaryPulse,
} from "./cameraPath";

// Reusable temporaries — never allocate inside useFrame (spec §10 perf discipline).
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

// VELOCITY LANGUAGE — the lens stretches with scroll speed (55° → up to 60°),
// so a committed flick *feels* faster without touching the authored path.
// FOV_VELOCITY_K is sized so a hard flick (Lenis |velocity| ≈ 25+) reaches the
// full stretch while a reading-pace creep (~2) barely registers. Tune the K on
// a real-GPU run, not by eye in the preview tab.
const FOV_BASE = 55;
const FOV_STRETCH_MAX = 5;
const FOV_VELOCITY_K = 0.2;

/**
 * The single camera (spec §3.1). It does not jump between sections — scroll
 * scrubs it continuously through one AUTHORED set of keyframes. Both its position
 * and its look-at target are hand-authored per progress (see cameraPath.ts) and
 * sampled with cubic-Hermite, so each dimension is framed deliberately instead of
 * the camera swinging to follow a curve's tangent. We read the smoothed scroll
 * `progress` from the store via getState() (never a hook subscription) so the
 * render loop triggers zero React re-renders.
 */
export function Rig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const damped = useRef(0);
  // Previous frame's DAMPED progress — the edge detector for boundary events
  // (the camera's actual crossing, not the raw scrollbar's).
  const prevDamped = useRef(0);
  // Smoothed FOV state (velocity stretch); projection matrix rebuilt only on
  // real change (>0.01°) — updateProjectionMatrix every frame is wasted work.
  const fov = useRef(FOV_BASE);
  const pMouse = useRef({ x: 0, y: 0 });

  // Dev-only: expose the live camera + renderer so a real (non-hidden) browser
  // can assert the rig moves and read draw-call counts. Stripped in production.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as {
        __camera?: THREE.Camera;
        __gl?: THREE.WebGLRenderer;
      };
      w.__camera = camera;
      w.__gl = gl;
    }
  }, [camera, gl]);

  useFrame((state, dt) => {
    const st = useExperience.getState();
    const target = st.progress;

    // Endless-loop wrap: when progress jumps across the seam (e.g. ~1 -> ~0),
    // SNAP instead of damping — damping would reverse-fly the whole dive. The
    // LoopVeil masks the snap so it reads as a seamless loop (spec §3.2).
    let snapped = false;
    if (Math.abs(target - damped.current) > 0.5) {
      damped.current = target;
      snapped = true;
    } else if (st.reducedMotion) {
      // Reduced motion: track the scroll 1:1 — no inertia, no overshoot, and no
      // boundary damping-kick. The visitor's input maps directly to position.
      damped.current = target;
    } else {
      // Critical-damping on top of Lenis' inertia gives the camera *weight*: it
      // "falls forward" with momentum instead of tracking the scrollbar 1:1.
      // Boundary kick: briefly raise the damping lambda (not the z position) so
      // crossings feel like *passing through*, not gliding (spec §3.2).
      const kick = boundaryPulse(target).pulse;
      damped.current = THREE.MathUtils.damp(damped.current, target, 3.5 + kick * 6, dt);
    }
    const p = clamp(damped.current, 0, 1);

    // BOUNDARY EVENTS — edge-detect the DAMPED progress crossing each boundary.
    // This is the single source of truth every transition surface consumes
    // (flash, CA kick, audio stingers): one event per crossing, stamped with
    // time/velocity/direction. A store write inside useFrame is DELIBERATE here
    // and acceptable: crossings are rare (≤5 per pass), not per-frame. Loop-seam
    // snaps are excluded — a snap "crosses" every boundary but is not an impact.
    if (!snapped) {
      const prev = prevDamped.current;
      for (let i = 0; i < BOUNDARY_PROGRESS.length; i++) {
        const b = BOUNDARY_PROGRESS[i];
        const fwd = prev < b && p >= b;
        if (fwd || (prev > b && p <= b)) {
          st.setLastBoundary({
            index: i,
            at: performance.now(),
            velocity: Math.abs(st.velocity),
            direction: fwd ? 1 : -1,
          });
        }
      }
    }
    prevDamped.current = p;

    // Authored position + look-at target for this progress (no tangent swing).
    sampleCamera(p, _pos, _look);
    // Hand the look-target to depth-of-field so the focal plane tracks the framed
    // subject (the Effects DOF pass reads this each frame).
    focusTarget.copy(_look);

    // Mouse parallax: a SUBTLE positional lean toward the cursor (damped) for
    // hand-held life. Position-only — the authored look target is NOT offset, so
    // the gaze never swings off the framed subject. `pointer` is R3F −1..1.
    pMouse.current.x = THREE.MathUtils.damp(pMouse.current.x, state.pointer.x, 3, dt);
    pMouse.current.y = THREE.MathUtils.damp(pMouse.current.y, state.pointer.y, 3, dt);

    camera.position.set(
      _pos.x + pMouse.current.x * 0.25,
      _pos.y + pMouse.current.y * 0.15,
      _pos.z,
    );
    camera.lookAt(_look);

    // Velocity → FOV stretch (smoothed, clamped). Skipped under reduced motion:
    // a widening lens is exactly the class of motion that path opts out of.
    // (Camera read from the frame state, not the hook value — property writes on
    // hook-returned objects trip react-hooks/immutability; same object either way.)
    const cam = state.camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const fovTarget = st.reducedMotion
        ? FOV_BASE
        : FOV_BASE + clamp(Math.abs(st.velocity) * FOV_VELOCITY_K, 0, FOV_STRETCH_MAX);
      fov.current = THREE.MathUtils.damp(fov.current, fovTarget, 4, dt);
      if (Math.abs(cam.fov - fov.current) > 0.01) {
        cam.fov = fov.current;
        cam.updateProjectionMatrix();
      }
    }

    // Active dimension = the arrival key the scroll is nearest (in progress).
    // progress-based now that position is authored (the start key sits at z≈6,
    // only incidentally near the City's depth). Low-frequency: write on change.
    let dim = 0;
    let best = Infinity;
    for (let i = 0; i < ZONE_PROGRESS.length; i++) {
      const d = Math.abs(p - ZONE_PROGRESS[i]);
      if (d < best) {
        best = d;
        dim = i;
      }
    }
    if (dim !== useExperience.getState().dimension) {
      useExperience.getState().setDimension(dim);
    }
  });

  return null;
}
