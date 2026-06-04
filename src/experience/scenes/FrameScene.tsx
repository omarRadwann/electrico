import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 3 — The Steel Frame (spec §7): the hidden order beneath the surface.
 * An instanced beam cage (columns + horizontal members, 1 draw call) the camera
 * flies through. Cool rim-lit steel; verb: PULSE — a slow emissive breathing as
 * if the structure is under load.
 */

const A = ZONES[2].position; // (2.5, 2, -102)
const MAX_BEAMS = 80;
const GRID = 3;
const SPAN = 7;
const HEIGHT = 32;
const LEVELS = 6;

export function FrameScene() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;

    // Vertical columns at the grid intersections.
    for (let cx = 0; cx < GRID; cx++) {
      for (let cz = 0; cz < GRID; cz++) {
        const x = A.x + (cx - (GRID - 1) / 2) * SPAN;
        const z = A.z + (cz - (GRID - 1) / 2) * SPAN;
        dummy.position.set(x, A.y, z);
        dummy.scale.set(0.32, HEIGHT, 0.32);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    // Horizontal members per level, in both directions.
    for (let l = 0; l < LEVELS && i < MAX_BEAMS; l++) {
      const y = A.y - HEIGHT / 2 + (l / (LEVELS - 1)) * HEIGHT;
      for (let cz = 0; cz < GRID && i < MAX_BEAMS; cz++) {
        const z = A.z + (cz - (GRID - 1) / 2) * SPAN;
        dummy.position.set(A.x, y, z);
        dummy.scale.set((GRID - 1) * SPAN + 0.32, 0.26, 0.26);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
      for (let cx = 0; cx < GRID && i < MAX_BEAMS; cx++) {
        const x = A.x + (cx - (GRID - 1) / 2) * SPAN;
        dummy.position.set(x, y, A.z);
        dummy.scale.set(0.26, 0.26, (GRID - 1) * SPAN + 0.32);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((s) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.4 + 0.3 * Math.sin(s.clock.elapsedTime * 1.4);
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_BEAMS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color="#9aa6bd"
        emissive="#42557d"
        emissiveIntensity={0.45}
        roughness={0.35}
        metalness={0.85}
      />
    </instancedMesh>
  );
}
