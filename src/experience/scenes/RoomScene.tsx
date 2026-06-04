import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 4 — The Smart Living Room (spec §7): warm, human, intelligent. A
 * floor + walls lit by a warm lamp, with teal smart-device glows; verb: THINK —
 * the devices pulse together like a calm heartbeat. Shared device material at
 * module scope (SSR-safe, mutated per-frame outside any hook value).
 */

const A = ZONES[3].position; // (-2, -2, -138)
const FLOOR_Y = A.y - 3;

const DEVICE_MAT = new THREE.MeshStandardMaterial({
  color: "#08302f",
  emissive: "#43d0c4",
  emissiveIntensity: 1.6,
  toneMapped: false,
  roughness: 0.4,
  metalness: 0.3,
});

const DEVICES: [number, number, number][] = [
  [A.x - 4, FLOOR_Y + 1.4, A.z - 2],
  [A.x + 5, FLOOR_Y + 3.2, A.z - 4],
  [A.x + 2, FLOOR_Y + 0.6, A.z + 3],
  [A.x - 3, FLOOR_Y + 4.6, A.z + 1],
];

export function RoomScene() {
  useFrame((s) => {
    DEVICE_MAT.emissiveIntensity = 0.9 + 0.8 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.2));
  });

  return (
    <group>
      {/* Warm interior light — the human glow of the room. */}
      <pointLight
        position={[A.x, A.y + 3, A.z + 3]}
        intensity={30}
        distance={28}
        color="#ffd2a0"
      />
      {/* Floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[A.x, FLOOR_Y, A.z]}>
        <planeGeometry args={[44, 54]} />
        <meshStandardMaterial color="#1b1410" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Back + side wall forming a corner. */}
      <mesh position={[A.x, FLOOR_Y + 11, A.z - 13]}>
        <planeGeometry args={[44, 26]} />
        <meshStandardMaterial color="#241a13" roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[A.x - 18, FLOOR_Y + 11, A.z]}>
        <planeGeometry args={[40, 26]} />
        <meshStandardMaterial color="#201712" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Smart devices (teal). */}
      {DEVICES.map((p, i) => (
        <mesh key={i} position={p} material={DEVICE_MAT}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}
