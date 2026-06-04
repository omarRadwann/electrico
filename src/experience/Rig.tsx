import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";
import { CAMERA_PATH, ZONES } from "./cameraPath";

// Reusable temporaries — never allocate inside useFrame (spec §10 perf discipline).
const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * The single camera (spec §3.1). It does not jump between sections — scroll
 * scrubs it continuously along one authored path. We read the smoothed scroll
 * `progress` from the store via getState() (never a hook subscription) so the
 * render loop triggers zero React re-renders.
 */
export function Rig() {
  const camera = useThree((s) => s.camera);
  const damped = useRef(0);

  // Dev-only: expose the live camera so a real (non-hidden) browser can assert
  // the rig actually moves. Stripped from production builds.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __camera?: THREE.Camera }).__camera = camera;
    }
  }, [camera]);

  useFrame((_, dt) => {
    const target = useExperience.getState().progress;

    // Critical-damping on top of Lenis' inertia gives the camera *weight*: it
    // "falls forward" with momentum instead of tracking the scrollbar 1:1.
    damped.current = THREE.MathUtils.damp(damped.current, target, 3.5, dt);
    const p = clamp(damped.current, 0, 1);

    CAMERA_PATH.getPointAt(p, _pos);
    CAMERA_PATH.getTangentAt(p, _tan); // defined at p=1 — avoids lookAt-self.
    camera.position.copy(_pos);
    _look.copy(_pos).add(_tan);
    camera.lookAt(_look);

    // Active dimension is low-frequency: only write when it actually changes,
    // so subscribers (HUD, debug) don't churn every frame.
    const dim = clamp(Math.floor(p * ZONES.length), 0, ZONES.length - 1);
    if (dim !== useExperience.getState().dimension) {
      useExperience.getState().setDimension(dim);
    }
  });

  return null;
}
