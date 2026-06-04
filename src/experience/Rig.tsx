import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";
import { sampleCamera, ZONE_PROGRESS, boundaryPulse } from "./cameraPath";

// Reusable temporaries — never allocate inside useFrame (spec §10 perf discipline).
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

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
    const target = useExperience.getState().progress;

    // Endless-loop wrap: when progress jumps across the seam (e.g. ~1 -> ~0),
    // SNAP instead of damping — damping would reverse-fly the whole dive. The
    // LoopVeil masks the snap so it reads as a seamless loop (spec §3.2).
    if (Math.abs(target - damped.current) > 0.5) {
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

    // Authored position + look-at target for this progress (no tangent swing).
    sampleCamera(p, _pos, _look);

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
