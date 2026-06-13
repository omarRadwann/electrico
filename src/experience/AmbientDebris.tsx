import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { clamp } from "@/src/lib/math";

/**
 * Drifting electric embers through the whole corridor — faint glowing motes (the
 * brand palette: amber / steel / teal) that bloom softly, twinkle, and sway. They
 * give the dive parallax + a sense of charged air between dimensions so the
 * *motion* stays legible and the world feels alive, not empty. One instanced draw
 * (perf §8.1); `toneMapped:false` so they read as pure light through the bloom.
 *
 * VELOCITY LANGUAGE: at scroll speed the embers elongate along the dive axis
 * (world z) about their own centers — motes become streaking sparks, selling
 * speed with zero extra draws. Under reduced motion the field is fully static:
 * no twinkle, no sway, no streaks.
 */
const DEBRIS_COUNT = 320;

// Streak tuning: a committed flick (Lenis |velocity| ≈ 25+) reaches ~4× world-z
// elongation; eased both ways so streaks stretch into and relax out of speed
// instead of snapping. Tune on a real-GPU run.
const STRETCH_VELOCITY_K = 0.12;
const STRETCH_MAX = 4;

// Brand palette, weighted toward warm power (amber). Module scope (no render-phase
// allocation); brightness is baked per-instance and re-twinkled in useFrame.
const PALETTE = [
  new THREE.Color("#e8a23d"),
  new THREE.Color("#e8a23d"),
  new THREE.Color("#ffae3a"),
  new THREE.Color("#43d0c4"),
  new THREE.Color("#8a94a6"),
];
const _c = new THREE.Color();

export function AmbientDebris() {
  const ref = useRef<THREE.InstancedMesh>(null);
  // Base (unstretched) instance matrices, copied once after seeding. The streak
  // rescales from THIS copy every time, so repeated stretching never compounds.
  const base = useRef<Float32Array | null>(null);
  const stretch = useRef(1);
  const appliedStretch = useRef(1);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const zStart = 8;
    const zEnd = -216;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 13;
      const z = zStart + (zEnd - zStart) * (i / DEBRIS_COUNT) + (Math.random() - 0.5) * 5;
      dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(0.04 + Math.random() * 0.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Most embers are dim; a few burn bright. Brand-coloured.
      const bright = Math.random() < 0.25 ? 1.2 + Math.random() * 1.3 : 0.25 + Math.random() * 0.6;
      _c.copy(PALETTE[(Math.random() * PALETTE.length) | 0]).multiplyScalar(bright);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    base.current = (mesh.instanceMatrix.array as Float32Array).slice();
  }, []);

  // Twinkle a handful each frame + a slow vertical sway so the field feels alive.
  useFrame((s, dt) => {
    const mesh = ref.current;
    if (!mesh || !mesh.instanceColor) return;
    const st = useExperience.getState();

    // Reduced motion: freeze the field entirely (twinkle is exactly the ambient
    // flicker the preference opts out of) and restore any leftover streak once.
    if (st.reducedMotion) {
      if (base.current && appliedStretch.current !== 1) {
        appliedStretch.current = 1;
        stretch.current = 1;
        (mesh.instanceMatrix.array as Float32Array).set(base.current);
        mesh.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    for (let k = 0; k < 5; k++) {
      const i = (Math.random() * DEBRIS_COUNT) | 0;
      const bright = Math.random() < 0.25 ? 1.2 + Math.random() * 1.4 : 0.22 + Math.random() * 0.6;
      _c.copy(PALETTE[(Math.random() * PALETTE.length) | 0]).multiplyScalar(bright);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceColor.needsUpdate = true;
    mesh.position.y = Math.sin(s.clock.elapsedTime * 0.25) * 0.5;

    // Streak elongation along the dive axis. Scaling about each instance's own
    // center along WORLD z is a pre-multiply that only touches the matrix's
    // linear z-row — column-major elements 2/6/10 (translation el 14 is the
    // pivot, untouched). Rewritten from the base copy only when the eased value
    // actually moved (>0.01), so a parked dive uploads nothing.
    const target = 1 + clamp(Math.abs(st.velocity) * STRETCH_VELOCITY_K, 0, STRETCH_MAX - 1);
    stretch.current = THREE.MathUtils.damp(stretch.current, target, 6, dt);
    const b = base.current;
    if (b && Math.abs(stretch.current - appliedStretch.current) > 0.01) {
      appliedStretch.current = stretch.current;
      const sz = stretch.current;
      const arr = mesh.instanceMatrix.array as Float32Array;
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const o = i * 16;
        arr[o + 2] = b[o + 2] * sz;
        arr[o + 6] = b[o + 6] * sz;
        arr[o + 10] = b[o + 10] * sz;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
