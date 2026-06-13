"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useExperience } from "@/src/store/useExperience";

/**
 * The City, alive: traffic light-streaks flowing along the street grid + red
 * aircraft warning beacons blinking over the skyline. Pure motion — what turns a
 * lit model into a living city. Two instanced draws, `toneMapped:false` so the
 * lights bloom into streaks. Animation is deterministic per-frame (no allocation).
 */

const CITY = ZONES[0].position;
const GROUND_Y = -7;
const EXTENT = 28; // half-size of the street grid
const SPACING = 8;
const STREET_Y = GROUND_Y + 0.35;

const TRAFFIC = 54;
const BEACONS = 9;

// Towers are clamped to half-width ≤ 2.0 (CityScene.TOWER_MAX_HALF); a streak lane
// laid HALF a cell off the tower grid line sits in the street gap. Clamp the lane
// jitter so a streak never wanders out of the gap and clips a tower corner.
const LANE_OFFSET = SPACING / 2; // centre lanes between tower rows (the streets)
const LANE_JITTER = 0.6; // ≤ (gap/2 − tower_half − streak_half) → stays in-street

// Seeded LCG so the traffic layout is deterministic across reloads (matches the
// rest of the City; nothing here touches the flight line — the grid sits ≥y=−6.6).
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Streak {
  axisZ: boolean; // travels along z (else along x)
  fixed: number; // the perpendicular street line
  pos: number; // position along the lane (-EXTENT..EXTENT)
  speed: number; // signed
  len: number;
}

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();
const HEAD = new THREE.Color("#ffd27a"); // warm headlight
const TAIL = new THREE.Color("#ff3b30"); // red taillight
const COOL = new THREE.Color("#9fd0ff");

export function CityLife() {
  const trafficRef = useRef<THREE.InstancedMesh>(null);
  const beaconRef = useRef<THREE.InstancedMesh>(null);
  const streaks = useRef<Streak[]>([]);
  const beaconPhase = useRef<number[]>([]);

  useLayoutEffect(() => {
    const rng = makeRng(0x4d21);
    // Traffic streaks on the street grid — lanes sit in the STREET GAPS (half a
    // cell off the tower grid) with clamped jitter so they never clip a tower.
    const arr: Streak[] = [];
    const tr = trafficRef.current;
    for (let i = 0; i < TRAFFIC; i++) {
      const axisZ = rng() < 0.5;
      const lane = (Math.floor(rng() * 7) - 3) * SPACING + LANE_OFFSET + (rng() - 0.5) * LANE_JITTER;
      const fixed = (axisZ ? CITY.x : CITY.z) + lane;
      const pos = (rng() * 2 - 1) * EXTENT;
      const dir = rng() < 0.5 ? 1 : -1;
      const speed = (8 + rng() * 14) * dir;
      const len = 1.0 + rng() * 2.2;
      arr.push({ axisZ, fixed, pos, speed, len });
      if (tr) {
        const isTail = rng() < 0.32;
        _col.copy(rng() < 0.12 ? COOL : isTail ? TAIL : HEAD).multiplyScalar(isTail ? 1.1 : 1.8);
        tr.setColorAt(i, _col);
      }
    }
    streaks.current = arr;
    if (tr && tr.instanceColor) tr.instanceColor.needsUpdate = true;

    // Aircraft warning beacons high over the skyline.
    const bc = beaconRef.current;
    const phases: number[] = [];
    if (bc) {
      for (let i = 0; i < BEACONS; i++) {
        _dummy.position.set(
          CITY.x + (rng() * 2 - 1) * EXTENT,
          GROUND_Y + 12 + rng() * 8,
          CITY.z + (rng() * 2 - 1) * EXTENT,
        );
        _dummy.scale.setScalar(0.16 + rng() * 0.1);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        bc.setMatrixAt(i, _dummy.matrix);
        _col.setRGB(0.2, 0.02, 0.01);
        bc.setColorAt(i, _col);
        phases.push(rng() * Math.PI * 2);
      }
      bc.instanceMatrix.needsUpdate = true;
      if (bc.instanceColor) bc.instanceColor.needsUpdate = true;
    }
    beaconPhase.current = phases;
  }, []);

  useFrame((s, dt) => {
    // PERF: the City is on screen only at boot + each loop seam. Skip the traffic
    // matrix + beacon color uploads once the camera has dived out of the City band
    // (these streaks are invisible from a dimension away). Matches CityScene's gate.
    if (useExperience.getState().progress > 0.25) return;

    // Traffic flow.
    const tr = trafficRef.current;
    if (tr) {
      const arr = streaks.current;
      for (let i = 0; i < arr.length; i++) {
        const st = arr[i];
        st.pos += st.speed * dt;
        if (st.pos > EXTENT) st.pos = -EXTENT;
        else if (st.pos < -EXTENT) st.pos = EXTENT;
        if (st.axisZ) {
          _dummy.position.set(st.fixed, STREET_Y, CITY.z + st.pos);
          _dummy.scale.set(0.09, 0.05, st.len);
        } else {
          _dummy.position.set(CITY.x + st.pos, STREET_Y, st.fixed);
          _dummy.scale.set(st.len, 0.05, 0.09);
        }
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        tr.setMatrixAt(i, _dummy.matrix);
      }
      tr.instanceMatrix.needsUpdate = true;
    }

    // Beacon blink (sharp red pulse, each on its own phase).
    const bc = beaconRef.current;
    if (bc && bc.instanceColor) {
      const t = s.clock.elapsedTime;
      const ph = beaconPhase.current;
      for (let i = 0; i < ph.length; i++) {
        const b = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 + ph[i]), 6);
        _col.setRGB(b * 1.5, b * 0.12, b * 0.08);
        bc.setColorAt(i, _col);
      }
      bc.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={trafficRef} args={[undefined, undefined, TRAFFIC]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beaconRef} args={[undefined, undefined, BEACONS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
