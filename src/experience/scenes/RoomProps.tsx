"use client";

import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Lived-in props for the Smart Room — a small stack of books on the rug and a
 * floor pouf. They sit low in the focal furniture cluster the camera looks down
 * at (park ≈(-1,1.8,-129) aiming at ≈(-3,-3.5,-138)), so the room reads as a real
 * home someone lives in, not a showroom. Static meshes, warm/muted palette.
 *
 * The plant + bookshelf live in RoomScene now: the icosphere "plant" was replaced
 * by the real PottedPlant.glb there, and the bookshelf gained real shelf boards
 * plus an instanced book run. These props are the remaining cosy human cues. All
 * sit at floor level inside the cluster, far below/clear of the flight line.
 */

const A = ZONES[3].position; // (-2, -2, -138)
const FLOOR_Y = A.y - 3; // -5

const POUF = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.95, metalness: 0.02 });
const BOOK_A = new THREE.MeshStandardMaterial({ color: "#6a3a28", roughness: 0.85 });
const BOOK_B = new THREE.MeshStandardMaterial({ color: "#27384a", roughness: 0.85 });
const BOOK_C = new THREE.MeshStandardMaterial({ color: "#4a3320", roughness: 0.85 });

export function RoomProps() {
  return (
    <group>
      {/* A small stack of books on the rug — a casual human detail by the sofa. */}
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
          receiveShadow
        >
          <boxGeometry args={[1.4, 0.22, 1]} />
        </mesh>
      ))}

      {/* Floor pouf / ottoman — extra warm seating in the cluster. */}
      <mesh position={[A.x + 0.6, FLOOR_Y + 0.45, A.z + 2.4]} material={POUF} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.9, 20]} />
      </mesh>
    </group>
  );
}
