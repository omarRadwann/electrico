import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 5 — Inside the Wall: Wiring (spec §7): the nervous system. The camera
 * travels *among* the cables — dark insulated conduits for mass + exposed live
 * copper conductors that bloom. Verb: SURGE — the current pulses along the copper,
 * and electric ARCS crackle between the wires (random blue-white sparks that flash
 * and fade). Curves hug the camera path so it reads as "inside the wall".
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

// Electric arc sparks.
const SPARKS = 16;
const _sd = new THREE.Object3D();
const _sc = new THREE.Color();
const ARC = new THREE.Color("#cfe6ff"); // blue-white

export function WiringScene() {
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const bright = useRef<number[]>([]);

  useLayoutEffect(() => {
    const m = sparkRef.current;
    if (!m) return;
    const b: number[] = [];
    for (let i = 0; i < SPARKS; i++) {
      _sd.position.set(
        A.x + (Math.random() - 0.5) * 7,
        A.y + (Math.random() - 0.5) * 7,
        A.z + (Math.random() - 0.5) * 56,
      );
      _sd.scale.setScalar(0.05 + Math.random() * 0.09);
      _sd.rotation.set(0, 0, 0);
      _sd.updateMatrix();
      m.setMatrixAt(i, _sd.matrix);
      _sc.setRGB(0, 0, 0);
      m.setColorAt(i, _sc);
      b.push(0);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    bright.current = b;
  }, []);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    // Surge: a fast pulse riding a slower swell.
    COPPER_MAT.emissiveIntensity =
      1.0 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4)) + 0.4 * Math.sin(t * 1.3);

    // Arc crackle: each spark decays fast; a small random chance to re-ignite.
    const m = sparkRef.current;
    if (m && m.instanceColor) {
      const b = bright.current;
      const decay = Math.max(0, 1 - dt * 9);
      for (let i = 0; i < b.length; i++) {
        b[i] *= decay;
        if (Math.random() < 0.006) b[i] = 1.6 + Math.random() * 1.6;
        _sc.copy(ARC).multiplyScalar(b[i]);
        m.setColorAt(i, _sc);
      }
      m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {CONDUIT_GEOMS.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={CONDUIT_MAT} />
      ))}
      {COPPER_GEOMS.map((g, i) => (
        <mesh key={`w${i}`} geometry={g} material={COPPER_MAT} />
      ))}
      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
