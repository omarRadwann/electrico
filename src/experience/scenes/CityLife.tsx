"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

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
    // Traffic streaks on the street grid.
    const arr: Streak[] = [];
    const tr = trafficRef.current;
    for (let i = 0; i < TRAFFIC; i++) {
      const axisZ = Math.random() < 0.5;
      const lane = (Math.floor(Math.random() * 7) - 3) * SPACING + (Math.random() - 0.5) * 1.5;
      const fixed = (axisZ ? CITY.x : CITY.z) + lane;
      const pos = (Math.random() * 2 - 1) * EXTENT;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = (8 + Math.random() * 14) * dir;
      const len = 1.0 + Math.random() * 2.2;
      arr.push({ axisZ, fixed, pos, speed, len });
      if (tr) {
        const isTail = Math.random() < 0.32;
        _col.copy(Math.random() < 0.12 ? COOL : isTail ? TAIL : HEAD).multiplyScalar(isTail ? 1.1 : 1.8);
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
          CITY.x + (Math.random() * 2 - 1) * EXTENT,
          GROUND_Y + 12 + Math.random() * 8,
          CITY.z + (Math.random() * 2 - 1) * EXTENT,
        );
        _dummy.scale.setScalar(0.16 + Math.random() * 0.1);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        bc.setMatrixAt(i, _dummy.matrix);
        _col.setRGB(0.2, 0.02, 0.01);
        bc.setColorAt(i, _col);
        phases.push(Math.random() * Math.PI * 2);
      }
      bc.instanceMatrix.needsUpdate = true;
      if (bc.instanceColor) bc.instanceColor.needsUpdate = true;
    }
    beaconPhase.current = phases;
  }, []);

  useFrame((s, dt) => {
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
