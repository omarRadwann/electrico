import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 5 — Inside the Wall: Wiring (spec §7): the nervous system. The camera
 * travels *among* the cables — dark insulated conduits for mass + exposed live
 * copper conductors that bloom. Verb: SURGE — the current pulses along the copper.
 * Curves hug the camera path so it reads as "inside the wall". Geometry + shared
 * materials at module scope (SSR-safe).
 */

const A = ZONES[4].position; // (1.5, 1, -174)

function makeCurve(k: number, jitter: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const bx = A.x + (Math.random() - 0.5) * jitter;
  const by = A.y + (Math.random() - 0.5) * jitter;
  for (let s = 0; s <= 7; s++) {
    const z = A.z + 30 - (s / 7) * 60;
    pts.push(
      new THREE.Vector3(
        bx + Math.sin(s * 1.2 + k) * 1.4,
        by + Math.cos(s * 1.05 + k * 1.7) * 1.4,
        z,
      ),
    );
  }
  return new THREE.CatmullRomCurve3(pts);
}

// Dark insulated conduits (mass) + bright copper conductors (live current).
const CONDUIT_GEOMS = Array.from(
  { length: 5 },
  (_, k) => new THREE.TubeGeometry(makeCurve(k, 6), 90, 0.34 + Math.random() * 0.12, 9, false),
);
const COPPER_GEOMS = Array.from(
  { length: 4 },
  (_, k) => new THREE.TubeGeometry(makeCurve(k + 20, 3.5), 90, 0.11 + Math.random() * 0.05, 8, false),
);

const CONDUIT_MAT = new THREE.MeshStandardMaterial({
  color: "#15110c",
  roughness: 0.85,
  metalness: 0.2,
});
const COPPER_MAT = new THREE.MeshStandardMaterial({
  color: "#3a1e08",
  emissive: "#ff7a1f",
  emissiveIntensity: 1.5,
  toneMapped: false,
  roughness: 0.45,
  metalness: 0.7,
});

export function WiringScene() {
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    // Surge: a fast pulse riding a slower swell.
    COPPER_MAT.emissiveIntensity =
      1.0 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4)) + 0.4 * Math.sin(t * 1.3);
  });

  return (
    <group>
      {CONDUIT_GEOMS.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={CONDUIT_MAT} />
      ))}
      {COPPER_GEOMS.map((g, i) => (
        <mesh key={`w${i}`} geometry={g} material={COPPER_MAT} />
      ))}
    </group>
  );
}
