import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 5 — Inside the Wall: Wiring & Maintenance (spec §7). The camera travels
 * AMONG the cables — dark insulated conduits + live copper conductors that bloom and
 * surge, electric ARCS crackling between them. Now read as a MAINTAINED system: a
 * breaker/distribution panel at the destination (the hero icon) + color-coded circuit
 * bands on the copper (red/yellow/blue/green) — universally "electrical."
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

const CONDUIT_CURVES = Array.from({ length: 5 }, (_, k) => makeCurve(k, 6));
const COPPER_CURVES = Array.from({ length: 4 }, (_, k) => makeCurve(k + 20, 3.5));
const CONDUIT_GEOMS = CONDUIT_CURVES.map(
  (c) => new THREE.TubeGeometry(c, 90, 0.34 + Math.random() * 0.12, 9, false),
);
const COPPER_GEOMS = COPPER_CURVES.map(
  (c) => new THREE.TubeGeometry(c, 90, 0.11 + Math.random() * 0.05, 8, false),
);

const CONDUIT_MAT = new THREE.MeshStandardMaterial({ color: "#15110c", roughness: 0.85, metalness: 0.2 });
const COPPER_MAT = new THREE.MeshStandardMaterial({
  color: "#3a1e08", emissive: "#ff7a1f", emissiveIntensity: 1.5, toneMapped: false, roughness: 0.45, metalness: 0.7,
});

// Electric arc sparks.
const SPARKS = 16;
const _sd = new THREE.Object3D();
const _sc = new THREE.Color();
const ARC = new THREE.Color("#cfe6ff");

// Circuit-ID color bands on the copper.
const BAND_COLORS = [
  new THREE.Color("#ff4040"), new THREE.Color("#ffd23a"),
  new THREE.Color("#4071ff"), new THREE.Color("#46e06a"),
];
const BAND_TS = [0.22, 0.4, 0.58, 0.76];
const _bp = new THREE.Vector3();
const _bt = new THREE.Vector3();
const _bq = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const _bo = new THREE.Object3D();

// Breaker panel at the destination (offset right of the flight path, ahead in view).
const BOX = new THREE.Vector3(A.x + 4.5, A.y - 1, A.z - 18); // (6, 0, -192)
const BREAKERS = 24;

export function WiringScene() {
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const bandRef = useRef<THREE.InstancedMesh>(null);
  const breakerRef = useRef<THREE.InstancedMesh>(null);
  const bright = useRef<number[]>([]);

  useLayoutEffect(() => {
    const m = sparkRef.current;
    if (m) {
      const b: number[] = [];
      for (let i = 0; i < SPARKS; i++) {
        _sd.position.set(A.x + (Math.random() - 0.5) * 7, A.y + (Math.random() - 0.5) * 7, A.z + (Math.random() - 0.5) * 56);
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
    }

    // Color-coded circuit bands sampled along each copper conductor.
    const band = bandRef.current;
    if (band) {
      let i = 0;
      COPPER_CURVES.forEach((curve, ci) => {
        BAND_TS.forEach((t, ti) => {
          curve.getPointAt(t, _bp);
          curve.getTangentAt(t, _bt);
          _bq.setFromUnitVectors(_Y, _bt); // cylinder axis (y) → tangent
          _bo.position.copy(_bp);
          _bo.quaternion.copy(_bq);
          _bo.scale.set(0.42, 0.16, 0.42);
          _bo.updateMatrix();
          band.setMatrixAt(i, _bo.matrix);
          band.setColorAt(i, BAND_COLORS[(ci + ti) % 4]);
          i++;
        });
      });
      band.count = i;
      band.instanceMatrix.needsUpdate = true;
      if (band.instanceColor) band.instanceColor.needsUpdate = true;
    }

    // Breaker grid on the panel's +z face (rows of small switches; a few live amber).
    const brk = breakerRef.current;
    if (brk) {
      let i = 0;
      const cols = 4;
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = BOX.x + (c / (cols - 1) - 0.5) * 2.0;
          const y = BOX.y + (r / (rows - 1) - 0.5) * 2.8;
          _bo.position.set(x, y, BOX.z + 0.55);
          _bo.quaternion.identity();
          _bo.scale.set(0.32, 0.34, 0.12);
          _bo.updateMatrix();
          brk.setMatrixAt(i, _bo.matrix);
          _sc.copy(Math.random() < 0.25 ? new THREE.Color("#ffb24d") : new THREE.Color("#4d9fff")).multiplyScalar(1.4);
          brk.setColorAt(i, _sc);
          i++;
        }
      }
      brk.count = i;
      brk.instanceMatrix.needsUpdate = true;
      if (brk.instanceColor) brk.instanceColor.needsUpdate = true;
    }
  }, []);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    COPPER_MAT.emissiveIntensity = 1.0 + 0.7 * (0.5 + 0.5 * Math.sin(t * 4)) + 0.4 * Math.sin(t * 1.3);

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

      {/* Circuit-ID color bands on the copper (red/yellow/blue/green = "electrical"). */}
      <instancedMesh ref={bandRef} args={[undefined, undefined, 16]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10, 1, true]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Breaker / distribution panel — the maintained-system endpoint (hero icon). */}
      <mesh position={[BOX.x, BOX.y, BOX.z]} material={CONDUIT_MAT}>
        <boxGeometry args={[2.8, 3.6, 1]} />
      </mesh>
      {/* open access door, hinged to the side */}
      <mesh position={[BOX.x - 1.9, BOX.y, BOX.z + 0.4]} rotation={[0, 0.6, 0]} material={CONDUIT_MAT}>
        <boxGeometry args={[2.6, 3.4, 0.08]} />
      </mesh>
      <instancedMesh ref={breakerRef} args={[undefined, undefined, BREAKERS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <pointLight position={[BOX.x, BOX.y, BOX.z + 3]} color="#7fb0ff" intensity={10} distance={18} decay={2} />
    </group>
  );
}
