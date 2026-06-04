import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 4 — The Smart Living Room (spec §7): warm, human, intelligent. A
 * furnished corner (sofa, table, bookshelf) lit by a visible warm lamp that
 * CASTS SHADOWS — the grounded shadow on the floor/walls is the realism win here.
 * Verb: THINK — the teal smart devices pulse like a calm heartbeat. Shadows are
 * enabled selectively (only this lamp casts; see createRenderer) so the cost is
 * contained to one interior. Shared mutable materials at module scope (SSR-safe).
 */

const A = ZONES[3].position; // (-2, -2, -138)
const FLOOR_Y = A.y - 3;

const WOOD = new THREE.MeshStandardMaterial({ color: "#241a12", roughness: 0.85, metalness: 0.08 });
const WALL = new THREE.MeshStandardMaterial({ color: "#211913", roughness: 0.92, metalness: 0.04 });
const RUG = new THREE.MeshStandardMaterial({ color: "#2e2016", roughness: 0.97, metalness: 0.02 });
const LAMP = new THREE.MeshStandardMaterial({
  color: "#3a2c18", emissive: "#ffcf95", emissiveIntensity: 1.8, toneMapped: false,
});
const DEVICE = new THREE.MeshStandardMaterial({
  color: "#08302f", emissive: "#43d0c4", emissiveIntensity: 1.6, toneMapped: false, roughness: 0.4,
});

const LAMP_X = A.x + 6.5;
const LAMP_Z = A.z - 3;

useGLTF.preload("/models/sofa/Sofa_01_1k.gltf");
useGLTF.preload("/models/coffeetable/CoffeeTable_01_1k.gltf");
useGLTF.preload("/models/armchair/ArmChair_01_1k.gltf");

function enableShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

export function RoomScene() {
  // Real CC0 furniture (Poly Haven) replacing the boxes. Suspends while loading
  // (see the <Suspense> wrap in Experience). Traverse once for shadow cast/receive.
  const { scene: sofa } = useGLTF("/models/sofa/Sofa_01_1k.gltf");
  const { scene: table } = useGLTF("/models/coffeetable/CoffeeTable_01_1k.gltf");
  const { scene: chair } = useGLTF("/models/armchair/ArmChair_01_1k.gltf");
  useLayoutEffect(() => {
    enableShadows(sofa);
    enableShadows(table);
    enableShadows(chair);
  }, [sofa, table, chair]);

  useFrame((s) => {
    DEVICE.emissiveIntensity = 0.9 + 0.8 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.2));
  });

  return (
    <group>
      {/* Warm light, with a visible fixture — and it casts the room's shadows. */}
      <pointLight
        position={[LAMP_X, FLOOR_Y + 5, LAMP_Z]}
        intensity={70}
        distance={34}
        color="#ffcf9a"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.003}
      />
      {/* Warm fill over the furniture cluster so the real models read clearly
          against the dark interior (no shadow — just lift). */}
      <pointLight position={[A.x - 2, FLOOR_Y + 6, A.z + 1]} intensity={45} distance={24} color="#ffe2b4" />

      {/* Shell: floor + back wall + side wall (a corner) — all catch shadow. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[A.x, FLOOR_Y, A.z]} receiveShadow>
        <planeGeometry args={[46, 56]} />
        <meshStandardMaterial color="#1b1410" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh position={[A.x, FLOOR_Y + 11, A.z - 14]} material={WALL} receiveShadow>
        <planeGeometry args={[46, 28]} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[A.x - 19, FLOOR_Y + 11, A.z]} material={WALL} receiveShadow>
        <planeGeometry args={[44, 28]} />
      </mesh>

      {/* Standing lamp: pole + glowing head (the light's source). */}
      <mesh position={[LAMP_X, FLOOR_Y + 2.5, LAMP_Z]} material={WOOD} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 5, 8]} />
      </mesh>
      <mesh position={[LAMP_X, FLOOR_Y + 5, LAMP_Z]} material={LAMP}>
        <sphereGeometry args={[0.5, 18, 18]} />
      </mesh>

      {/* Real sofa (Poly Haven CC0 GLB) — scale/rotation tuned to the room. */}
      <primitive object={sofa} position={[A.x - 3, FLOOR_Y, A.z + 1]} scale={5.5} rotation={[0, Math.PI, 0]} />
      <primitive object={table} position={[A.x - 3, FLOOR_Y, A.z - 1.5]} scale={5} rotation={[0, 0.4, 0]} />
      {/* Bookshelf + rug + side table — silhouettes that give the room volume. */}
      <mesh position={[A.x + 7, FLOOR_Y + 3, A.z - 13]} material={WOOD} castShadow receiveShadow>
        <boxGeometry args={[3.2, 6, 0.6]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[A.x - 4, FLOOR_Y + 0.03, A.z + 1]} material={RUG} receiveShadow>
        <planeGeometry args={[7.5, 5.5]} />
      </mesh>
      <primitive object={chair} position={[A.x + 4, FLOOR_Y, A.z + 2]} scale={5} rotation={[0, -0.9, 0]} />

      {/* Smart devices (teal): a wall panel + a speaker on the table + a sensor. */}
      <mesh position={[A.x, FLOOR_Y + 7, A.z - 13.6]} material={DEVICE}>
        <boxGeometry args={[3.2, 1.8, 0.12]} />
      </mesh>
      <mesh position={[A.x - 4, FLOOR_Y + 0.95, A.z - 0.6]} material={DEVICE} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.4]} />
      </mesh>
      <mesh position={[LAMP_X, FLOOR_Y + 0.3, LAMP_Z + 1.5]} material={DEVICE} castShadow>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
      </mesh>
    </group>
  );
}
