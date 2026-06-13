"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";

/**
 * The Building is a SITE UNDER CONSTRUCTION — a tower crane (the instant "we raise
 * structures" icon) lifting over the lit tower, scaffolding wrapping the exposed
 * steel crown, and warm work lights raking the frame. Everything sits frame-right /
 * above the dive's flight line so the camera never clips it. Mostly dark steel
 * silhouettes with selective emissive (beacon, work lamps) so it reads at a glance.
 */

const A = ZONES[1].position; // (-3, -1.5, -66)
const FACADE_Z = A.z - 3; // -69
const BODY_Z = FACADE_Z - 8; // -77

// Crane geometry. The arrival camera looks LEVEL at the facade, so a tall crane's
// top falls above the frame — keep it lower + central-right so the jib + hanging
// load sit IN frame and read as a crane. Mast clear of the flight path (x≈0.8).
const CRANE_X = A.x + 9; // 6 — central-right, in frame
const CRANE_Z = BODY_Z; // -77
const MAST_BOT = -8;
const MAST_TOP = 13;
const JIB_Y = 11;
const JIB_REACH = 18; // extends in −x, out over the facade
const HOOK_X = CRANE_X - JIB_REACH * 0.6; // ≈ -4.8, over the facade
const MAST_HALF = 1.3;
const MAX_CRANE_BEAMS = 90;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);
const _o = new THREE.Object3D();

const STEEL = new THREE.MeshStandardMaterial({ color: "#2b2f38", roughness: 0.55, metalness: 0.8 });

export function BuildingSite() {
  const tier = TIERS[useExperience((s) => s.quality)];
  const craneRef = useRef<THREE.InstancedMesh>(null);
  const scaffoldRef = useRef<THREE.InstancedMesh>(null);
  const markerRef = useRef<THREE.InstancedMesh>(null);
  const beaconRef = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const crane = craneRef.current;
    if (crane) {
      let i = 0;
      const beam = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        th: number,
      ) => {
        if (i >= MAX_CRANE_BEAMS) return;
        _a.set(ax, ay, az);
        _b.set(bx, by, bz);
        _mid.copy(_a).lerp(_b, 0.5);
        _dir.copy(_b).sub(_a).normalize();
        _q.setFromUnitVectors(_X, _dir);
        _o.position.copy(_mid);
        _o.quaternion.copy(_q);
        _o.scale.set(_a.distanceTo(_b), th, th);
        _o.updateMatrix();
        crane.setMatrixAt(i++, _o.matrix);
      };

      // Mast — 4 lattice columns + ring beams + X-bracing.
      const mx = [CRANE_X - MAST_HALF, CRANE_X + MAST_HALF, CRANE_X + MAST_HALF, CRANE_X - MAST_HALF];
      const mz = [CRANE_Z - MAST_HALF, CRANE_Z - MAST_HALF, CRANE_Z + MAST_HALF, CRANE_Z + MAST_HALF];
      for (let k = 0; k < 4; k++) beam(mx[k], MAST_BOT, mz[k], mx[k], MAST_TOP, mz[k], 0.32);
      const rings = 7;
      for (let r = 0; r < rings; r++) {
        const y = MAST_BOT + (r / (rings - 1)) * (MAST_TOP - MAST_BOT);
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          beam(mx[k], y, mz[k], mx[n], y, mz[n], 0.16);
        }
      }
      for (let r = 0; r < rings - 1; r++) {
        const y0 = MAST_BOT + (r / (rings - 1)) * (MAST_TOP - MAST_BOT);
        const y1 = MAST_BOT + ((r + 1) / (rings - 1)) * (MAST_TOP - MAST_BOT);
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          if ((r + k) % 2 === 0) beam(mx[k], y0, mz[k], mx[n], y1, mz[n], 0.14);
          else beam(mx[n], y0, mz[n], mx[k], y1, mz[k], 0.14);
        }
      }

      // Jib (working arm) — top + bottom chords + zig-zag web, out over the building.
      const jibEnd = CRANE_X - JIB_REACH;
      beam(CRANE_X, JIB_Y, CRANE_Z, jibEnd, JIB_Y, CRANE_Z, 0.22); // top chord
      beam(CRANE_X, JIB_Y - 1.6, CRANE_Z, jibEnd + 2, JIB_Y - 1.6, CRANE_Z, 0.2); // bottom chord
      const bays = 8;
      for (let k = 0; k < bays; k++) {
        const x0 = CRANE_X - (k / bays) * JIB_REACH;
        const x1 = CRANE_X - ((k + 1) / bays) * JIB_REACH;
        if (k % 2 === 0) beam(x0, JIB_Y, CRANE_Z, x1, JIB_Y - 1.6, CRANE_Z, 0.12);
        else beam(x1, JIB_Y, CRANE_Z, x0, JIB_Y - 1.6, CRANE_Z, 0.12);
      }
      // Counter-jib + tie bars from the apex.
      beam(CRANE_X, JIB_Y, CRANE_Z, CRANE_X + 8, JIB_Y, CRANE_Z, 0.22);
      beam(CRANE_X, MAST_TOP + 2, CRANE_Z, jibEnd + 4, JIB_Y, CRANE_Z, 0.1); // forward tie
      beam(CRANE_X, MAST_TOP + 2, CRANE_Z, CRANE_X + 8, JIB_Y, CRANE_Z, 0.1); // back tie
      // Hoist cable + a suspended load.
      beam(HOOK_X, JIB_Y - 1.6, CRANE_Z, HOOK_X, 3, CRANE_Z, 0.05);
      crane.count = i;
      crane.instanceMatrix.needsUpdate = true;
    }

    // Marker / warning lights tracing the crane's shape so it READS at night —
    // a dark steel silhouette would vanish against the night sky (the scene reads
    // by emitted light, like the city windows, not by silhouette).
    const mk = markerRef.current;
    if (mk) {
      let p = 0;
      const put = (x: number, y: number, z: number, s: number) => {
        _o.position.set(x, y, z);
        _o.quaternion.identity();
        _o.scale.setScalar(s);
        _o.updateMatrix();
        mk.setMatrixAt(p++, _o.matrix);
      };
      for (let m = 0; m < 5; m++) {
        put(CRANE_X + MAST_HALF, MAST_BOT + (m / 4) * (MAST_TOP - MAST_BOT), CRANE_Z + MAST_HALF, 0.28);
      }
      for (let m = 0; m < 7; m++) put(CRANE_X - (m / 6) * JIB_REACH, JIB_Y + 0.4, CRANE_Z, 0.28);
      put(HOOK_X, 3, CRANE_Z, 0.34); // hook load light
      put(CRANE_X, MAST_TOP + 0.4, CRANE_Z, 0.4); // apex
      mk.count = p;
      mk.instanceMatrix.needsUpdate = true;
    }

    // Scaffolding — vertical poles + rails wrapping the exposed crown (above the path).
    const sc = scaffoldRef.current;
    if (sc) {
      let j = 0;
      const sx = [A.x - 10, A.x + 4, A.x + 4, A.x - 10];
      const sz = [BODY_Z - 7, BODY_Z - 7, BODY_Z + 7, BODY_Z + 7];
      const yb = A.y + 13;
      const yt = A.y + 30;
      const poleBeam = (
        ax: number, ay: number, az: number, bx: number, by: number, bz: number,
      ) => {
        if (j >= 80) return;
        _a.set(ax, ay, az);
        _b.set(bx, by, bz);
        _mid.copy(_a).lerp(_b, 0.5);
        _dir.copy(_b).sub(_a).normalize();
        _q.setFromUnitVectors(_X, _dir);
        _o.position.copy(_mid);
        _o.quaternion.copy(_q);
        _o.scale.set(_a.distanceTo(_b), 0.12, 0.12);
        _o.updateMatrix();
        sc.setMatrixAt(j++, _o.matrix);
      };
      for (let k = 0; k < 4; k++) poleBeam(sx[k], yb, sz[k], sx[k], yt, sz[k]); // corner poles
      const levels = 5;
      for (let l = 0; l < levels; l++) {
        const y = yb + (l / (levels - 1)) * (yt - yb);
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          poleBeam(sx[k], y, sz[k], sx[n], y, sz[n]); // rails
        }
      }
      sc.count = j;
      sc.instanceMatrix.needsUpdate = true;
    }
  }, []);

  // Crane aviation beacon — slow red blink. Gated to the Building band so there's
  // no per-frame material write while the camera is in other dimensions (the
  // Building is only on screen p≈0.22–0.50).
  useFrame((s) => {
    if (useExperience.getState().progress > 0.52) return;
    if (beaconRef.current) {
      const b = Math.pow(0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 2.0), 4);
      beaconRef.current.emissiveIntensity = 0.3 + b * 3.5;
    }
  });

  return (
    <group>
      {/* Tower crane — always rendered (the hero "construction" icon). */}
      <instancedMesh ref={craneRef} args={[undefined, undefined, MAX_CRANE_BEAMS]} material={STEEL} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {/* Counterweight, operator cab, suspended load. */}
      <mesh position={[CRANE_X + 8, JIB_Y - 1.4, CRANE_Z]} material={STEEL}>
        <boxGeometry args={[2.2, 2.4, 2.6]} />
      </mesh>
      <mesh position={[CRANE_X, MAST_TOP - 1.4, CRANE_Z]} material={STEEL}>
        <boxGeometry args={[2, 1.8, 2.4]} />
      </mesh>
      <mesh position={[HOOK_X, 2.4, CRANE_Z]} material={STEEL}>
        <boxGeometry args={[2.4, 1.6, 2.4]} />
      </mesh>
      {/* Red aviation beacon on the mast top. LIT Standard material → toneMapped:true
          (the IBL/fill lights its sphere); the bloom punch comes from the pulsed
          emissiveIntensity (peaks ~3.8, well over the 0.55 threshold) in useFrame. */}
      <mesh position={[CRANE_X, MAST_TOP + 0.6, CRANE_Z]}>
        <sphereGeometry args={[0.4, 10, 10]} />
        <meshStandardMaterial ref={beaconRef} color="#3a0a08" emissive="#ff2a1a" emissiveIntensity={1} toneMapped roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Marker / warning lights tracing the crane's silhouette — cool white so it
          reads as a separate steel structure, distinct from the amber windows. */}
      <instancedMesh ref={markerRef} args={[undefined, undefined, 16]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#dceaff" toneMapped={false} />
      </instancedMesh>
      {/* Cool fill raking the crane steel so the lattice catches light (cheap, no shadow). */}
      <pointLight position={[CRANE_X + 3, JIB_Y - 4, CRANE_Z + 4]} color="#cfe0ff" intensity={22} distance={44} decay={2} />

      {/* Scaffolding around the crown — dense detail (full + reduced). */}
      {tier.props && (
        <instancedMesh ref={scaffoldRef} args={[undefined, undefined, 80]} material={STEEL} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
        </instancedMesh>
      )}

      {/* Site work lights — emissive lamp heads + warm pools (props); no shadows
          to stay cheap. The bright heads read as work lamps from the approach. */}
      {tier.props && (
        <group>
          {[
            [A.x - 11, A.y + 16, BODY_Z + 6],
            [A.x + 9, A.y + 10, BODY_Z - 6],
            [A.x - 4, A.y + 24, BODY_Z + 2],
          ].map(([x, y, z], k) => (
            <group key={k} position={[x, y, z]}>
              <mesh>
                <sphereGeometry args={[0.5, 10, 10]} />
                <meshBasicMaterial color="#fff0d2" toneMapped={false} />
              </mesh>
              {tier.heavyProps && <pointLight color="#ffe4b0" intensity={28} distance={26} decay={2} />}
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
