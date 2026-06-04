import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { boundaryPulse, ZONES } from "./cameraPath";

/**
 * The "moment of impact" (spec §3.2), done geometrically rather than via FBO
 * compositing (the dive is one continuous world, not separate scenes). A single
 * billboarded disc rides just in front of the camera and flares in the *incoming*
 * dimension's colour as `boundaryPulse` peaks at each crossing — an additive,
 * bloom-amplified flash that sells "I fell THROUGH into the next world", then
 * fades as you emerge. Invisible everywhere except the ~5 boundary moments.
 */

const _fwd = new THREE.Vector3();

export function Transitions() {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const { pulse, toIndex } = boundaryPulse(useExperience.getState().progress);
    if (pulse < 0.012) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // Ride in front of the camera, square to it (billboard).
    camera.getWorldDirection(_fwd);
    mesh.position.copy(camera.position).addScaledVector(_fwd, 6);
    mesh.quaternion.copy(camera.quaternion);

    // Tint toward the dimension we're entering; flare + grow with the pulse.
    mat.color.set(ZONES[Math.min(toIndex, ZONES.length - 1)].color);
    // Strong flare, but capped so parking exactly on a boundary still reads the
    // scene through it (not a solid colour wash).
    mat.opacity = pulse * 0.72;
    const s = 5 + pulse * 13;
    mesh.scale.set(s, s, 1);
  });

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false}>
      <circleGeometry args={[1, 48]} />
      <meshBasicMaterial
        ref={matRef}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
