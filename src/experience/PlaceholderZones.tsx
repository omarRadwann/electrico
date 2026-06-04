import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "./cameraPath";

/**
 * Throwaway M1 visuals whose only job is to make the *motion feel* legible:
 * one glowing ring "gateway" per dimension (coloured by service category) that
 * the camera dives through, plus a field of instanced debris for parallax.
 * All of this is replaced by real scenes + render-target portals in M2–M4.
 */

function Gateways() {
  return (
    <>
      {ZONES.map((z) => (
        <mesh key={z.index} position={z.position}>
          <torusGeometry args={[3.2, 0.12, 16, 80]} />
          {/* toneMapped=false keeps the rim punchy for the bloom pass added in M5 */}
          <meshStandardMaterial
            color={z.color}
            emissive={z.color}
            emissiveIntensity={1.4}
            toneMapped={false}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
      ))}
    </>
  );
}

const DEBRIS_COUNT = 260;

function Debris() {
  const ref = useRef<THREE.InstancedMesh>(null);

  // Scatter is generated in an effect (after render, not during it) so the
  // impure Math.random stays out of the render phase. Hollow core (radius >= 5)
  // keeps the camera path clear so debris streaks past on the periphery;
  // InstancedMesh keeps the whole field to a single draw call (perf §8.1).
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const zStart = 8;
    const zEnd = -216;
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 12;
      const z = zStart + (zEnd - zStart) * (i / DEBRIS_COUNT) + (Math.random() - 0.5) * 4;
      dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.setScalar(0.15 + Math.random() * 0.7);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#39415a" roughness={0.7} metalness={0.25} />
    </instancedMesh>
  );
}

export function PlaceholderZones() {
  return (
    <>
      <Gateways />
      <Debris />
    </>
  );
}
