"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";

/**
 * The City is a POWER GRID — glowing transformer substations pooling warm light on
 * the street blocks (read instantly from the overhead arrival) + steel transmission
 * pylons at the edges, traced with marker lights so the iconic cross-arm silhouette
 * reads at night. The hero "electrical infrastructure" cues for Power & Lighting.
 * Pylons sit lateral (x edges), clear of the descent path (x≈0–3).
 */

const CITY = ZONES[0].position; // (3, 1, -30)
const GROUND_Y = -7;

// Substation glow-pads on street blocks (warm orange — power infrastructure).
const SUBSTATIONS: [number, number][] = [
  [CITY.x - 14, CITY.z - 6],
  [CITY.x + 12, CITY.z + 8],
  [CITY.x - 4, CITY.z - 20],
  [CITY.x + 18, CITY.z - 14],
  [CITY.x - 20, CITY.z + 12],
];

// Transmission pylons at the edges (lateral — clear of the descent path).
const PYLONS: [number, number][] = [
  [CITY.x - 26, CITY.z - 4],
  [CITY.x + 28, CITY.z - 18],
  [CITY.x - 24, CITY.z - 40],
  [CITY.x + 24, CITY.z + 12],
];
const P_BOT = GROUND_Y;
const P_TOP = GROUND_Y + 26;
const ARM_HI = P_TOP - 3;
const ARM_LO = P_TOP - 7;
const ARM_REACH = 6;
const MAX_BEAMS = 220;
const MAX_MARKERS = 60;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);
const _o = new THREE.Object3D();

const PYLON_STEEL = new THREE.MeshStandardMaterial({ color: "#1c2029", roughness: 0.6, metalness: 0.85 });
const SUB_BODY = new THREE.MeshStandardMaterial({ color: "#1a130a", roughness: 0.7, metalness: 0.3 });

export function CityInfra() {
  const tier = TIERS[useExperience((s) => s.quality)];
  const pylonRef = useRef<THREE.InstancedMesh>(null);
  const markerRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const pylon = pylonRef.current;
    const mk = markerRef.current;
    if (!pylon || !mk) return;
    let bi = 0;
    let mi = 0;
    const beam = (
      ax: number, ay: number, az: number, bx: number, by: number, bz: number, th: number,
    ) => {
      if (bi >= MAX_BEAMS) return;
      _a.set(ax, ay, az);
      _b.set(bx, by, bz);
      _mid.copy(_a).lerp(_b, 0.5);
      _dir.copy(_b).sub(_a).normalize();
      _q.setFromUnitVectors(_X, _dir);
      _o.position.copy(_mid);
      _o.quaternion.copy(_q);
      _o.scale.set(_a.distanceTo(_b), th, th);
      _o.updateMatrix();
      pylon.setMatrixAt(bi++, _o.matrix);
    };
    const mark = (x: number, y: number, z: number, s: number) => {
      if (mi >= MAX_MARKERS) return;
      _o.position.set(x, y, z);
      _o.quaternion.identity();
      _o.scale.setScalar(s);
      _o.updateMatrix();
      mk.setMatrixAt(mi++, _o.matrix);
    };

    for (const [px, pz] of PYLONS) {
      const baseH = 2.2;
      const topH = 0.7;
      const legB = [
        [px - baseH, pz - baseH], [px + baseH, pz - baseH],
        [px + baseH, pz + baseH], [px - baseH, pz + baseH],
      ];
      const legT = [
        [px - topH, pz - topH], [px + topH, pz - topH],
        [px + topH, pz + topH], [px - topH, pz + topH],
      ];
      // 4 tapering legs.
      for (let k = 0; k < 4; k++) beam(legB[k][0], P_BOT, legB[k][1], legT[k][0], P_TOP, legT[k][1], 0.22);
      // Bracing rings + X-braces.
      const lv = 5;
      for (let l = 0; l < lv; l++) {
        const t = l / (lv - 1);
        const y = P_BOT + t * (P_TOP - P_BOT);
        const cx = legB.map((b, k) => [b[0] + (legT[k][0] - b[0]) * t, b[1] + (legT[k][1] - b[1]) * t]);
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          beam(cx[k][0], y, cx[k][1], cx[n][0], y, cx[n][1], 0.1);
        }
      }
      // Two cross-arms (the iconic pylon shape) + insulator marker lights at the tips.
      for (const ay of [ARM_HI, ARM_LO]) {
        beam(px - ARM_REACH, ay, pz, px + ARM_REACH, ay, pz, 0.14);
        mark(px - ARM_REACH, ay, pz, 0.3);
        mark(px + ARM_REACH, ay, pz, 0.3);
        mark(px, ay, pz, 0.24);
      }
      mark(px, P_TOP + 0.5, pz, 0.34); // top beacon position (steady white here)
    }
    pylon.count = bi;
    mk.count = mi;
    pylon.instanceMatrix.needsUpdate = true;
    mk.instanceMatrix.needsUpdate = true;
  }, []);

  // Subtle pulse on the substation glow so the grid feels live. Gated to the City
  // band — no per-frame material write once the camera has dived away (the City
  // is only on screen at boot + each loop seam).
  const subMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (useExperience.getState().progress > 0.25) return;
    if (subMatRef.current) {
      // Higher base + swing because the core is now toneMapped:true (filmic grade):
      // emissiveIntensity must clear the bloom threshold (0.55 pre-tonemap HDR) to
      // keep the transformer glow punching — the toneMapped-discipline recovery.
      subMatRef.current.emissiveIntensity = 2.4 + 0.8 * Math.sin(s.clock.elapsedTime * 1.5);
    }
  });

  return (
    <group>
      {/* Transmission pylons (always — hero power-grid icon). */}
      <instancedMesh ref={pylonRef} args={[undefined, undefined, MAX_BEAMS]} material={PYLON_STEEL} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Insulator / aviation marker lights tracing the cross-arms. */}
      <instancedMesh ref={markerRef} args={[undefined, undefined, MAX_MARKERS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#dfe8ff" toneMapped={false} />
      </instancedMesh>

      {/* Transformer substations — warm glowing enclosures on the street blocks. */}
      {SUBSTATIONS.map(([x, z], i) => (
        <group key={i} position={[x, GROUND_Y + 1, z]}>
          {/* enclosure body */}
          <mesh material={SUB_BODY} position={[0, 0.6, 0]}>
            <boxGeometry args={[3.2, 2.2, 3.2]} />
          </mesh>
          {/* glowing transformer core (pulses). LIT Standard material → it must be
              toneMapped:true (the IBL/ambient lights its faces); the "cheap neon"
              read came from bypassing the filmic grade. Bloom recovered via the
              higher emissiveIntensity in useFrame (initial value clears threshold). */}
          <mesh position={[0, 1.9, 0]}>
            <boxGeometry args={[2.4, 0.5, 2.4]} />
            <meshStandardMaterial
              ref={i === 0 ? subMatRef : undefined}
              color="#3a1c08"
              emissive="#ff8a30"
              emissiveIntensity={2.4}
              toneMapped
              roughness={0.5}
              metalness={0.2}
            />
          </mesh>
          {/* warm pool of light on the block (props tier) */}
          {tier.props && <pointLight position={[0, 3, 0]} color="#ffb060" intensity={30} distance={20} decay={2} />}
        </group>
      ))}

      {/* High-voltage power lines between pylons (full tier only). */}
      {tier.heavyProps && (
        <group>
          {PYLONS.slice(0, -1).map(([px, pz], i) => {
            const [nx, nz] = PYLONS[i + 1];
            const mids: THREE.Vector3[] = [
              new THREE.Vector3(px - ARM_REACH, ARM_HI, pz),
              new THREE.Vector3((px + nx) / 2 - ARM_REACH, ARM_HI - 3, (pz + nz) / 2),
              new THREE.Vector3(nx - ARM_REACH, ARM_HI, nz),
            ];
            const curve = new THREE.CatmullRomCurve3(mids);
            return (
              <mesh key={i}>
                <tubeGeometry args={[curve, 24, 0.05, 5, false]} />
                <meshBasicMaterial color="#6a7a9a" toneMapped={false} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}
