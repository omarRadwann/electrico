import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 5 — Inside the Wall: Wiring (spec §7): the nervous system. A bundle
 * of conduits the camera travels along, with live copper cores; verb: SURGE — the
 * current pulses brightly along the conductors. Built from TubeGeometry along
 * Catmull-Rom curves (geometry + shared material at module scope, SSR-safe).
 */

const A = ZONES[4].position; // (1.5, 1, -174)
const COUNT = 7;

function makeCurve(k: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const bx = A.x + (Math.random() - 0.5) * 5;
  const by = A.y + (Math.random() - 0.5) * 5;
  for (let s = 0; s <= 6; s++) {
    const z = A.z + 26 - (s / 6) * 52;
    pts.push(
      new THREE.Vector3(bx + Math.sin(s * 1.3 + k) * 2, by + Math.cos(s * 1.1 + k) * 2, z),
    );
  }
  return new THREE.CatmullRomCurve3(pts);
}

const WIRE_GEOMETRIES = Array.from(
  { length: COUNT },
  (_, k) => new THREE.TubeGeometry(makeCurve(k), 80, 0.1 + Math.random() * 0.07, 8, false),
);

const WIRE_MAT = new THREE.MeshStandardMaterial({
  color: "#2a1606",
  emissive: "#ff7a1f",
  emissiveIntensity: 1.4,
  toneMapped: false,
  roughness: 0.5,
  metalness: 0.6,
});

export function WiringScene() {
  useFrame((s) => {
    WIRE_MAT.emissiveIntensity = 1.0 + 1.0 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 3));
  });

  return (
    <group>
      {WIRE_GEOMETRIES.map((g, i) => (
        <mesh key={i} geometry={g} material={WIRE_MAT} />
      ))}
    </group>
  );
}
