import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 2 — The Building (spec §7): approaching, architectural, grounded. A
 * lit facade the camera dives toward (its windows fill the view before the M3
 * dissolve into the steel frame), flanked by darker building masses set off the
 * camera path for silhouette/parallax. Verb: APPROACH (mostly still — the drama
 * is the camera closing on it). Procedural, texture-free.
 */

const A = ZONES[1].position; // (-3, -1.5, -66)
const FACADE_Z = A.z - 3;
const FW = 22; // facade width
const FH = 34; // facade height
const COLS = 12;
const ROWS = 16;
const WIN = COLS * ROWS;
const WIN_COLOR = new THREE.Color("#ffc46b");

export function BuildingScene() {
  const winRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const w = winRef.current;
    if (!w) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = A.x + (c / (COLS - 1) - 0.5) * FW + (Math.random() - 0.5) * 0.4;
        const y = A.y + (r / (ROWS - 1) - 0.5) * FH + (Math.random() - 0.5) * 0.4;
        dummy.position.set(x, y, FACADE_Z);
        dummy.scale.set(0.7, 0.95, 0.12);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        w.setMatrixAt(i, dummy.matrix);
        const brightness = Math.random() < 0.22 ? 0.0 : 0.45 + Math.random() * 1.2;
        color.copy(WIN_COLOR).multiplyScalar(brightness);
        w.setColorAt(i, color);
        i++;
      }
    }
    w.instanceMatrix.needsUpdate = true;
    if (w.instanceColor) w.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      {/* Flanking building masses, well off the camera path (silhouette). */}
      <mesh position={[A.x - 22, A.y - 6, A.z - 2]}>
        <boxGeometry args={[14, 54, 14]} />
        <meshStandardMaterial color="#0b0f18" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[A.x + 20, A.y - 4, A.z - 8]}>
        <boxGeometry args={[13, 48, 13]} />
        <meshStandardMaterial color="#0a0e16" roughness={0.7} metalness={0.25} />
      </mesh>

      {/* Lit facade the camera dives toward. */}
      <instancedMesh ref={winRef} args={[undefined, undefined, WIN]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
