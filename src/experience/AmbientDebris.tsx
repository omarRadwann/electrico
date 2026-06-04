import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Ambient debris / dust motes drifting through the whole corridor, giving the
 * dive parallax between dimensions so the *motion* stays legible. One instanced
 * draw call (perf §8.1). (Replaces the M1 gateway-ring placeholders, now that
 * every dimension has a real scene.)
 */
const DEBRIS_COUNT = 260;

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
      const radius = 5 + Math.random() * 12;
      const z = zStart + (zEnd - zStart) * (i / DEBRIS_COUNT) + (Math.random() - 0.5) * 4;
      dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.setScalar(0.12 + Math.random() * 0.45);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#39415a" roughness={0.7} metalness={0.25} />
    </instancedMesh>
  );
}
