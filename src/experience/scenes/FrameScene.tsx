import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 3 — The Steel Frame (spec §7): the hidden order beneath the surface.
 * A 4-column truss with perimeter ring beams and zig-zag cross-bracing — the
 * cross-braces are what make it read as *structural steel* rather than a room.
 * Thin dark members, cool rim, verb: PULSE (slow emissive breathing, as if loaded).
 * One instanced draw call.
 */

const A = ZONES[2].position; // (2.5, 2, -102)
const MAX_BEAMS = 64;
const S = 6; // half-span between columns
const H = 30;
const LEVELS = 5;
const TH = 0.16; // member thickness

// Module-scope temporaries — reused while laying out beams (one scene, sequential).
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);

export function FrameScene() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;

    // Place one box-beam spanning a->b (local +x aligned to the member axis).
    const setBeam = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      thick: number,
    ) => {
      if (i >= MAX_BEAMS) return;
      _a.set(ax, ay, az);
      _b.set(bx, by, bz);
      _mid.copy(_a).lerp(_b, 0.5);
      _dir.copy(_b).sub(_a).normalize();
      _q.setFromUnitVectors(_X, _dir);
      dummy.position.copy(_mid);
      dummy.quaternion.copy(_q);
      dummy.scale.set(_a.distanceTo(_b), thick, thick);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    };

    const yBot = A.y - H / 2;
    const yTop = A.y + H / 2;
    const cx = [A.x - S, A.x + S, A.x + S, A.x - S];
    const cz = [A.z - S, A.z - S, A.z + S, A.z + S];

    // Columns.
    for (let k = 0; k < 4; k++) setBeam(cx[k], yBot, cz[k], cx[k], yTop, cz[k], 0.22);

    // Perimeter ring beams at each level.
    for (let l = 0; l < LEVELS; l++) {
      const y = yBot + (l / (LEVELS - 1)) * H;
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        setBeam(cx[k], y, cz[k], cx[n], y, cz[n], TH);
      }
    }

    // Zig-zag diagonal cross-bracing on every face — the structural signature.
    for (let l = 0; l < LEVELS - 1; l++) {
      const y0 = yBot + (l / (LEVELS - 1)) * H;
      const y1 = yBot + ((l + 1) / (LEVELS - 1)) * H;
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        if ((l + k) % 2 === 0) setBeam(cx[k], y0, cz[k], cx[n], y1, cz[n], TH);
        else setBeam(cx[n], y0, cz[n], cx[k], y1, cz[k], TH);
      }
    }

    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((s) => {
    if (matRef.current) {
      // Glowing cool x-ray skeleton (spec §7: the hidden order / blueprint). The
      // beams read clearly against the dark and pulse as if under load.
      matRef.current.emissiveIntensity = 0.55 + 0.3 * Math.sin(s.clock.elapsedTime * 1.4);
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_BEAMS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color="#586273"
        emissive="#4d74c8"
        emissiveIntensity={0.7}
        toneMapped={false}
        roughness={0.3}
        metalness={0.9}
      />
    </instancedMesh>
  );
}
