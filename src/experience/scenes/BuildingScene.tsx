import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 2 — The Building (spec §7): approaching, architectural, grounded.
 * A tower the camera dives toward: a lit glass facade over a solid base, crowned
 * by an EXPOSED STEEL skeleton (under construction — "we raise the structures",
 * and a deliberate foreshadow of THE FRAME next). A deeper cluster of silhouette
 * masses gives the skyline real depth instead of one facade floating in void.
 *
 * The dive flies THROUGH the facade's mid band (kept thin), so the solid mass is
 * placed as a base BELOW and a crown ABOVE the camera's flight line — body without
 * blocking the path. Verb: APPROACH. One instanced draw for the facade, one for
 * the crown girders.
 */

const A = ZONES[1].position; // (-3, -1.5, -66)
const FACADE_Z = A.z - 3; // -69
const FW = 22; // facade width
const FH = 34; // facade height
const COLS = 12;
const ROWS = 16;
const WIN = COLS * ROWS;
const FAR_WIN = 280; // distant lit windows scattered across the skyline masses
const WIN_COLOR = new THREE.Color("#ffc46b");
const COOL_WIN = new THREE.Color("#bcd2ff"); // ~15% of windows read cooler — real skylines aren't one colour

// Solid tower body lives below the flight line; crown above it. Front face on the
// facade plane so the windows read as set into the building.
const BODY_Z = FACADE_Z - 8; // -77 (centre; front face ≈ FACADE_Z)
const CROWN_Y0 = A.y + FH / 2 - 2; // ≈ +14.5, just under the facade top
const CROWN_Y1 = CROWN_Y0 + 15; // exposed steel rises above the lit floors
const CROWN_BEAMS = 24;

// Background skyline masses — kept clear of the dive path (|x|≥13 when deep) and
// short of the Frame's z-region, so the camera never flies through one.
const SKYLINE: [number, number, number, number, number, number][] = [
  // x, y, z, width, height, depth
  [A.x - 22, A.y - 10, A.z - 16, 16, 52, 16],
  [A.x + 18, A.y - 9, A.z - 14, 14, 48, 14],
  [A.x + 14, A.y - 13, A.z, 10, 36, 10],
  [A.x - 18, A.y - 12, A.z - 24, 14, 46, 14],
  [A.x + 16, A.y - 14, A.z - 24, 12, 42, 12],
];

// Crown beam layout temporaries (one scene, sequential).
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);

export function BuildingScene() {
  const winRef = useRef<THREE.InstancedMesh>(null);
  const farWinRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const crownMat = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const w = winRef.current;
    if (w) {
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
          color.copy(Math.random() < 0.15 ? COOL_WIN : WIN_COLOR).multiplyScalar(brightness);
          w.setColorAt(i, color);
          i++;
        }
      }
      w.instanceMatrix.needsUpdate = true;
      if (w.instanceColor) w.instanceColor.needsUpdate = true;
    }

    // Exposed steel crown — an open girder cage on top of the tower.
    const crown = crownRef.current;
    if (crown) {
      const dummy = new THREE.Object3D();
      let i = 0;
      const setBeam = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        thick: number,
      ) => {
        if (i >= CROWN_BEAMS) return;
        _a.set(ax, ay, az);
        _b.set(bx, by, bz);
        _mid.copy(_a).lerp(_b, 0.5);
        _dir.copy(_b).sub(_a).normalize();
        _q.setFromUnitVectors(_X, _dir);
        dummy.position.copy(_mid);
        dummy.quaternion.copy(_q);
        dummy.scale.set(_a.distanceTo(_b), thick, thick);
        dummy.updateMatrix();
        crown.setMatrixAt(i++, dummy.matrix);
      };
      const sx = 9; // crown half-width
      const sz = 6; // crown half-depth
      const cx = [A.x - sx, A.x + sx, A.x + sx, A.x - sx];
      const cz = [BODY_Z - sz, BODY_Z - sz, BODY_Z + sz, BODY_Z + sz];
      // 4 corner columns
      for (let k = 0; k < 4; k++) setBeam(cx[k], CROWN_Y0, cz[k], cx[k], CROWN_Y1, cz[k], 0.2);
      // ring beams at base, mid, top
      for (const y of [CROWN_Y0, (CROWN_Y0 + CROWN_Y1) / 2, CROWN_Y1]) {
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          setBeam(cx[k], y, cz[k], cx[n], y, cz[n], 0.14);
        }
      }
      // one diagonal brace per face (lower half)
      const ymid = (CROWN_Y0 + CROWN_Y1) / 2;
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        setBeam(cx[k], CROWN_Y0, cz[k], cx[n], ymid, cz[n], 0.13);
      }
      crown.count = i;
      crown.instanceMatrix.needsUpdate = true;
    }

    // Distant lit windows scattered across the skyline masses — turns the dark
    // silhouettes into a living city backdrop with depth, filling the frame past
    // the main tower. Dimmer than the facade since they read as far away.
    const far = farWinRef.current;
    if (far) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      for (let n = 0; n < FAR_WIN; n++) {
        const [mx, my, mz, mw, mh, md] = SKYLINE[n % SKYLINE.length];
        const y = my + (Math.random() - 0.5) * mh * 0.9;
        const face = Math.random();
        let x: number;
        let z: number;
        if (face < 0.68) {
          // front (+z) face — what the approaching camera sees
          x = mx + (Math.random() - 0.5) * mw * 0.9;
          z = mz + md / 2 + 0.05;
          dummy.scale.set(0.5, 0.7, 0.1);
        } else {
          const sgn = face < 0.84 ? 1 : -1; // a side face
          x = mx + sgn * (mw / 2 + 0.05);
          z = mz + (Math.random() - 0.5) * md * 0.9;
          dummy.scale.set(0.1, 0.7, 0.5);
        }
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        far.setMatrixAt(n, dummy.matrix);
        const on = Math.random() < 0.4 ? 0.0 : 0.16 + Math.random() * 0.5;
        color.copy(Math.random() < 0.18 ? COOL_WIN : WIN_COLOR).multiplyScalar(on);
        far.setColorAt(n, color);
      }
      far.instanceMatrix.needsUpdate = true;
      if (far.instanceColor) far.instanceColor.needsUpdate = true;
    }
  }, []);

  useFrame((s) => {
    // Gentle steady glow — cooler/dimmer than THE FRAME so the Frame stays the
    // "blueprint" star, but enough to read as live exposed steel.
    if (crownMat.current) {
      crownMat.current.emissiveIntensity = 0.3 + 0.12 * Math.sin(s.clock.elapsedTime * 1.1);
    }
  });

  return (
    <group>
      {/* Background skyline — silhouette masses giving the city real depth. */}
      {SKYLINE.map(([x, y, z, w, h, d], idx) => (
        <mesh key={idx} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#0a0e16" roughness={0.72} metalness={0.22} />
        </mesh>
      ))}

      {/* Distant city windows on the skyline masses — depth + life in the backdrop. */}
      <instancedMesh ref={farWinRef} args={[undefined, undefined, FAR_WIN]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Solid tower base — the lower floors the lit facade is set into. Sits
          below the dive's flight line so the camera passes over it, not through. */}
      <mesh position={[A.x, A.y - 22, BODY_Z]}>
        <boxGeometry args={[26, 34, 16]} />
        <meshStandardMaterial color="#0c1119" roughness={0.7} metalness={0.28} />
      </mesh>

      {/* Lit facade the camera dives toward (thin — the mid band is the fly-through). */}
      <instancedMesh ref={winRef} args={[undefined, undefined, WIN]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Glass curtain in front of the windows — lit interiors behind glass
          (faint refraction + IBL sheen), not stickers on a wall. */}
      <mesh position={[A.x, A.y, FACADE_Z + 0.5]}>
        <planeGeometry args={[FW + 3, FH + 4]} />
        <meshPhysicalMaterial
          transmission={0.85}
          roughness={0.05}
          thickness={0.2}
          ior={1.45}
          metalness={0}
          color="#c8d4e6"
          transparent
          opacity={0.45}
        />
      </mesh>

      {/* Exposed steel crown — the structure being raised; foreshadows THE FRAME. */}
      <instancedMesh ref={crownRef} args={[undefined, undefined, CROWN_BEAMS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={crownMat}
          color="#4a5468"
          emissive="#4d74c8"
          emissiveIntensity={0.3}
          toneMapped={false}
          roughness={0.35}
          metalness={0.9}
        />
      </instancedMesh>
    </group>
  );
}
