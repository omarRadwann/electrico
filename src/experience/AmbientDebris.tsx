import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Drifting electric embers through the whole corridor — faint glowing motes (the
 * brand palette: amber / steel / teal) that bloom softly, twinkle, and sway. They
 * give the dive parallax + a sense of charged air between dimensions so the
 * *motion* stays legible and the world feels alive, not empty. One instanced draw
 * (perf §8.1); `toneMapped:false` so they read as pure light through the bloom.
 */
const DEBRIS_COUNT = 320;

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
  }, []);

  // Twinkle a handful each frame + a slow vertical sway so the field feels alive.
  useFrame((s) => {
    const mesh = ref.current;
    if (!mesh || !mesh.instanceColor) return;
    for (let k = 0; k < 5; k++) {
      const i = (Math.random() * DEBRIS_COUNT) | 0;
      const bright = Math.random() < 0.25 ? 1.2 + Math.random() * 1.4 : 0.22 + Math.random() * 0.6;
      _c.copy(PALETTE[(Math.random() * PALETTE.length) | 0]).multiplyScalar(bright);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceColor.needsUpdate = true;
    mesh.position.y = Math.sin(s.clock.elapsedTime * 0.25) * 0.5;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
