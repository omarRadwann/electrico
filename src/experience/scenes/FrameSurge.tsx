"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Power surging up the steel — bright energy nodes that ride up the Frame's
 * columns and loop, so the structure reads as electrically LOADED (spec §7: "as
 * if under load"), not just a static cage. Cool blue-white, toneMapped:false so it
 * blooms. One instanced draw; deterministic per-frame motion.
 */

const A = ZONES[2].position; // (2.5, 2, -102)
const S = 6;
const H = 30;
const Y_BOT = A.y - H / 2;

// The 6 unique column lines of the two-bay truss (x = A.x±S, z = A.z+S/-S/-3S).
const COLUMNS: [number, number][] = [
  [A.x - S, A.z + S],
  [A.x + S, A.z + S],
  [A.x - S, A.z - S],
  [A.x + S, A.z - S],
  [A.x - S, A.z - 3 * S],
  [A.x + S, A.z - 3 * S],
];
const ENERGY = 14;
const _d = new THREE.Object3D();

interface SurgeNode {
  col: number;
  phase: number; // 0..1 up the column
  speed: number;
}

export function FrameSurge() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const nodes = useRef<SurgeNode[]>([]);

  useLayoutEffect(() => {
    const arr: SurgeNode[] = [];
    for (let i = 0; i < ENERGY; i++) {
      arr.push({
        col: (Math.random() * COLUMNS.length) | 0,
        phase: Math.random(),
        speed: 0.16 + Math.random() * 0.22,
      });
    }
    nodes.current = arr;
  }, []);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const arr = nodes.current;
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      n.phase += n.speed * dt;
      if (n.phase > 1) n.phase -= 1;
      const [x, z] = COLUMNS[n.col];
      _d.position.set(x, Y_BOT + n.phase * H, z);
      // Fatter mid-travel, thin at the ends — a travelling pulse, not a dot.
      _d.scale.setScalar(0.16 + 0.5 * Math.sin(n.phase * Math.PI));
      _d.rotation.set(0, 0, 0);
      _d.updateMatrix();
      m.setMatrixAt(i, _d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, ENERGY]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#bcd6ff" toneMapped={false} />
    </instancedMesh>
  );
}
