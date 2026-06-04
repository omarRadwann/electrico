import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 1 — The City at Night (spec §7). The opening "powering on" vista the
 * camera descends into. Dark instanced towers (1 draw call) studded with ~1800
 * instanced emissive window lights (1 draw call) that bloom into a living grid.
 * Its one verb is FLICKER: a handful of windows blink on/off each moment.
 *
 * Procedural, texture-free — the cinematic look is built from glow, not photos
 * (real commissioned assets, spec §13, can replace this later).
 */

const CITY = ZONES[0].position; // dimension-1 anchor
const GROUND_Y = -7;
const COLS = 7;
const ROWS = 7;
const TOWERS = COLS * ROWS;
const WINDOWS = 1800;
const SPACING = 8;
const WIN_COLOR = new THREE.Color("#ffb24d"); // warm amber window light

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export function CityScene() {
  const towersRef = useRef<THREE.InstancedMesh>(null);
  const windowsRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const towers = towersRef.current;
    const windows = windowsRef.current;
    if (!towers || !windows) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const placed: Tower[] = [];

    // Towers on a jittered grid centred on the dimension-1 anchor.
    let ti = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c - COLS / 2) * SPACING + (Math.random() - 0.5) * 3 + CITY.x;
        const z = (r - ROWS / 2) * SPACING + (Math.random() - 0.5) * 3 + CITY.z;
        const w = 2.5 + Math.random() * 2.5;
        const d = 2.5 + Math.random() * 2.5;
        const h = 5 + Math.random() * 17;
        dummy.position.set(x, GROUND_Y + h / 2, z);
        dummy.scale.set(w, h, d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        towers.setMatrixAt(ti, dummy.matrix);
        placed.push({ x, z, w, d, h });
        ti++;
      }
    }
    towers.instanceMatrix.needsUpdate = true;

    // Window lights scattered on the tower faces. Some windows stay dark for
    // realistic variety; brightness varies per instance via instanceColor.
    dummy.rotation.set(0, 0, 0);
    for (let wi = 0; wi < WINDOWS; wi++) {
      const t = placed[wi % placed.length];
      const yy = GROUND_Y + 1 + Math.random() * (t.h - 1.5);
      const onX = Math.random() < 0.5;
      const sign = Math.random() < 0.5 ? 1 : -1;
      const ww = 0.18 + Math.random() * 0.14; // window width
      const wh = 0.3 + Math.random() * 0.26; // window height (taller than wide)
      let x: number;
      let z: number;
      // Flush with the facade (not proud) + thin along the face normal, so each
      // window reads as set *into* the tower, framed by the dark wall edge.
      if (onX) {
        x = t.x + sign * (t.w / 2);
        z = t.z + (Math.random() - 0.5) * t.d * 0.85;
        dummy.scale.set(0.06, wh, ww);
      } else {
        z = t.z + sign * (t.d / 2);
        x = t.x + (Math.random() - 0.5) * t.w * 0.85;
        dummy.scale.set(ww, wh, 0.06);
      }
      dummy.position.set(x, yy, z);
      dummy.updateMatrix();
      windows.setMatrixAt(wi, dummy.matrix);

      const brightness = Math.random() < 0.18 ? 0.0 : 0.5 + Math.random() * 1.4;
      color.copy(WIN_COLOR).multiplyScalar(brightness);
      windows.setColorAt(wi, color);
    }
    windows.instanceMatrix.needsUpdate = true;
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  }, []);

  // FLICKER: re-light a few random windows each frame so the city breathes.
  const color = useRef(new THREE.Color());
  useFrame(() => {
    const windows = windowsRef.current;
    if (!windows || !windows.instanceColor) return;
    for (let k = 0; k < 4; k++) {
      const wi = Math.floor(Math.random() * WINDOWS);
      const brightness = Math.random() < 0.25 ? 0.05 : 0.5 + Math.random() * 1.5;
      color.current.copy(WIN_COLOR).multiplyScalar(brightness);
      windows.setColorAt(wi, color.current);
    }
    windows.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Wet-street reflective ground — the window lights + tower silhouettes
          reflect in it. resolution capped at 512 (cost scales hard with it). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CITY.x, GROUND_Y, CITY.z]}>
        <planeGeometry args={[260, 260]} />
        <MeshReflectorMaterial
          resolution={256}
          mirror={0}
          blur={[300, 300]}
          mixBlur={2.5}
          mixStrength={0.55}
          roughness={0.85}
          depthScale={0}
          color="#070912"
          metalness={0.25}
        />
      </mesh>

      {/* Dark tower masses. */}
      <instancedMesh
        ref={towersRef}
        args={[undefined, undefined, TOWERS]}
        castShadow={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b101c" roughness={0.85} metalness={0.15} />
      </instancedMesh>

      {/* Emissive window lights — unlit basic material so they read as pure glow
          for the bloom pass; instanceColor carries per-window brightness. */}
      <instancedMesh
        ref={windowsRef}
        args={[undefined, undefined, WINDOWS]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
