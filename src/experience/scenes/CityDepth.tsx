"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Distant skyline behind/around the main City grid — a ring of taller, darker
 * towers studded with sparse dim windows, fading into the fog. Gives the opening
 * its sense of VASTNESS + depth (the city extends past the lit foreground) without
 * touching the camera path (kept lateral / far). Two instanced draws.
 */

const CITY = ZONES[0].position; // (3, 1, -30)
const GROUND_Y = -7;
const FAR_TOWERS = 46;
const FAR_WINDOWS = 420;
const WARM = new THREE.Color("#ffb24d");
const COOL = new THREE.Color("#bcd2ff");

interface Far {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export function CityDepth() {
  const towersRef = useRef<THREE.InstancedMesh>(null);
  const winRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const towers = towersRef.current;
    const windows = winRef.current;
    if (!towers || !windows) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const placed: Far[] = [];

    // Ring the foreground grid: radius 34–62 around the anchor, full circle.
    for (let i = 0; i < FAR_TOWERS; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 34 + Math.random() * 28;
      const x = CITY.x + Math.cos(ang) * rad;
      const z = CITY.z + Math.sin(ang) * rad * 0.7; // squash z a touch (reads wider)
      const w = 3 + Math.random() * 4;
      const d = 3 + Math.random() * 4;
      const h = 14 + Math.random() * 30; // taller than the foreground
      dummy.position.set(x, GROUND_Y + h / 2, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);
      placed.push({ x, z, w, d, h });
    }
    towers.instanceMatrix.needsUpdate = true;

    // Sparse dim windows on the far towers (dimmer than the foreground — distance).
    for (let i = 0; i < FAR_WINDOWS; i++) {
      const t = placed[i % placed.length];
      const yy = GROUND_Y + 1 + Math.random() * (t.h - 1.5);
      const onX = Math.random() < 0.5;
      const sign = Math.random() < 0.5 ? 1 : -1;
      const ww = 0.22 + Math.random() * 0.18;
      const wh = 0.34 + Math.random() * 0.3;
      let x: number;
      let z: number;
      if (onX) {
        x = t.x + sign * (t.w / 2);
        z = t.z + (Math.random() - 0.5) * t.d * 0.8;
        dummy.scale.set(0.08, wh, ww);
      } else {
        z = t.z + sign * (t.d / 2);
        x = t.x + (Math.random() - 0.5) * t.w * 0.8;
        dummy.scale.set(ww, wh, 0.08);
      }
      dummy.position.set(x, yy, z);
      dummy.updateMatrix();
      windows.setMatrixAt(i, dummy.matrix);
      const on = Math.random() < 0.3 ? 0 : 0.12 + Math.random() * 0.5; // dim + many dark
      color.copy(Math.random() < 0.16 ? COOL : WARM).multiplyScalar(on);
      windows.setColorAt(i, color);
    }
    windows.instanceMatrix.needsUpdate = true;
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={towersRef} args={[undefined, undefined, FAR_TOWERS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#090d16" roughness={0.9} metalness={0.1} />
      </instancedMesh>
      <instancedMesh ref={winRef} args={[undefined, undefined, FAR_WINDOWS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
