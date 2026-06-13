"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useExperience } from "@/src/store/useExperience";

/**
 * Power surging up the steel — bright energy nodes that ride up the Frame's
 * columns and loop, so the structure reads as electrically LOADED (spec §7: "as
 * if under load"), not just a static cage. Cool blue-white, toneMapped:false so it
 * blooms. One instanced draw; deterministic per-frame motion.
 *
 * THE SIGNATURE (briefing §10): each node also publishes its world position into
 * the module-scope SURGE_NODES array every frame. FrameScene reads that array in
 * its own useFrame and brightens the steel members the nodes physically ride —
 * the pulses literally LIGHT the beams, instead of floating as a separate glow
 * layer. The array is the single source of truth between the two files; it is
 * mutated in place (never reassigned) so it is allocation-free across the
 * Surge→Frame boundary, exactly like cameraPath's focusTarget.
 */

const A = ZONES[2].position; // (2.5, 2, -102)
const S = 6;
const H = 30;
const Y_BOT = A.y - H / 2;

// The 6 unique column lines of the (now three-bay) truss. FrameScene builds bays
// at z = A.z, A.z−2S, A.z−4S (-102, -114, -126); each bay shares the two z lines
// zc±S, so the distinct column z-values across the tunnel are A.z+S … A.z−5S.
// The surge climbs the four MOST-VISIBLE near lines (the camera frames the cage
// mouth around z≈-104..-120) so its light lands where the eye is.
const COLUMNS: [number, number][] = [
  [A.x - S, A.z + S],
  [A.x + S, A.z + S],
  [A.x - S, A.z - S],
  [A.x + S, A.z - S],
  [A.x - S, A.z - 3 * S],
  [A.x + S, A.z - 3 * S],
];
const ENERGY = 14;
const _d = new THREE.Object3D();

/**
 * Published surge node world-positions (x,y,z triples, length ENERGY*3), read by
 * FrameScene to drive per-beam emissive. Pre-seeded off-world so a first frame
 * before FrameSurge ticks lights nothing. Module-scope shared mutable state — the
 * deliberate, allocation-free coupling channel (briefing §10).
 */
export const SURGE_NODES = new Float32Array(ENERGY * 3).fill(9999);
export const SURGE_COUNT = ENERGY;

// Deterministic node seeding: the surge proximity math (FrameScene) is stable
// across reloads, and StrictMode's double effect can't reroll the layout.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SurgeNode {
  col: number;
  phase: number; // 0..1 up the column
  speed: number;
}

export function FrameSurge() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const nodes = useRef<SurgeNode[]>([]);

  useLayoutEffect(() => {
    const rand = mulberry32(0x57a9e1);
    const arr: SurgeNode[] = [];
    for (let i = 0; i < ENERGY; i++) {
      arr.push({
        col: (rand() * COLUMNS.length) | 0,
        phase: rand(),
        speed: 0.16 + rand() * 0.22,
      });
    }
    nodes.current = arr;
  }, []);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    // Velocity coupling: surges hurry as the visitor flicks the wheel (soft-knee
    // normalization — Lenis velocity has no fixed unit). Sound confirms motion;
    // here motion confirms input.
    const vel = Math.abs(useExperience.getState().velocity);
    const rush = 1 + 1.6 * (1 - Math.exp(-vel / 30));
    const arr = nodes.current;
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      n.phase += n.speed * dt * rush;
      if (n.phase > 1) n.phase -= 1;
      const [x, z] = COLUMNS[n.col];
      const y = Y_BOT + n.phase * H;
      _d.position.set(x, y, z);
      // Fatter mid-travel, thin at the ends — a travelling pulse, not a dot.
      _d.scale.setScalar(0.16 + 0.5 * Math.sin(n.phase * Math.PI));
      _d.rotation.set(0, 0, 0);
      _d.updateMatrix();
      m.setMatrixAt(i, _d.matrix);
      // Publish for FrameScene's per-beam emissive (single source of truth).
      const o = i * 3;
      SURGE_NODES[o] = x;
      SURGE_NODES[o + 1] = y;
      SURGE_NODES[o + 2] = z;
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, ENERGY]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#bcd6ff" toneMapped={false} />
    </instancedMesh>
  );
}
