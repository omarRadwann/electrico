"use client";

import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Lived-in props for the Smart Room — a potted plant (life + a green accent against
 * the warm interior), a stack of books, and a floor pouf. They sit in the focal
 * furniture cluster the camera looks down at, so the room reads as a real home
 * someone lives in, not a showroom. Static meshes, warm/muted palette.
 */

const A = ZONES[3].position; // (-2, -2, -138)
const FLOOR_Y = A.y - 3; // -5

const POT = new THREE.MeshStandardMaterial({ color: "#2a2420", roughness: 0.8, metalness: 0.05 });
const LEAF = new THREE.MeshStandardMaterial({ color: "#223a26", roughness: 0.9, metalness: 0 });
const POUF = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.95, metalness: 0.02 });
const BOOK_A = new THREE.MeshStandardMaterial({ color: "#6a3a28", roughness: 0.85 });
const BOOK_B = new THREE.MeshStandardMaterial({ color: "#27384a", roughness: 0.85 });
const BOOK_C = new THREE.MeshStandardMaterial({ color: "#4a3320", roughness: 0.85 });

export function RoomProps() {
  return (
    <group>
      {/* Potted plant — the life cue. Pot + a cluster of leaf spheres. */}
      <mesh position={[A.x + 2.6, FLOOR_Y + 0.55, A.z + 0.6]} material={POT} castShadow>
        <cylinderGeometry args={[0.5, 0.42, 1.1, 16]} />
      </mesh>
      {[
        [0, 1.5, 0, 0.75],
        [0.4, 1.9, 0.2, 0.55],
        [-0.35, 1.95, -0.15, 0.5],
        [0.1, 2.35, -0.1, 0.45],
      ].map(([dx, dy, dz, r], i) => (
        <mesh key={i} position={[A.x + 2.6 + dx, FLOOR_Y + dy, A.z + 0.6 + dz]} material={LEAF} castShadow>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}

      {/* A small stack of books on the rug. */}
      {[
        [BOOK_A, 0, 0.12, 0],
        [BOOK_B, 0.08, 0.34, -0.05],
        [BOOK_C, -0.05, 0.54, 0.04],
      ].map(([mat, dx, dy, rot], i) => (
        <mesh
          key={i}
          position={[A.x - 4.6 + (dx as number), FLOOR_Y + (dy as number), A.z + 0.8]}
          rotation={[0, rot as number, 0]}
          material={mat as THREE.Material}
          castShadow
        >
          <boxGeometry args={[1.4, 0.22, 1]} />
        </mesh>
      ))}

      {/* Floor pouf / ottoman — extra warm seating. */}
      <mesh position={[A.x + 0.6, FLOOR_Y + 0.45, A.z + 2.4]} material={POUF} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.9, 20]} />
      </mesh>
    </group>
  );
}
