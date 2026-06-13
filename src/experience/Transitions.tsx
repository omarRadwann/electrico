import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { ZONES } from "./cameraPath";
import { clamp } from "@/src/lib/math";

/**
 * The "moment of impact" (spec §3.2), done geometrically rather than via FBO
 * compositing (the dive is one continuous world, not separate scenes). A single
 * billboarded disc rides just in front of the camera and flares in the *incoming*
 * dimension's colour at each boundary crossing — an additive, bloom-amplified
 * flash that sells "I fell THROUGH into the next world", then fades as you emerge.
 *
 * EVENT-SHAPED, NOT PROGRESS-SHAPED: the flash is a ~300ms time envelope from
 * the Rig's edge-detected `lastBoundary` event — never a function of where the
 * scrollbar is parked. The old progress-Gaussian meant parking near a boundary
 * held a permanent ~72% wash on the frame, and a creep and a blast produced the
 * same flash. Now the peak scales with crossing |velocity| (creep = shimmer,
 * blast = impact), and reduced motion gets NO flash at all (photosensitivity —
 * a full-frame additive strobe is exactly what that preference opts out of).
 * `boundaryPulse` remains in use ONLY for the Rig's damping-kick.
 */

const _fwd = new THREE.Vector3();

// Envelope: instant attack (the crossing IS the impact), quadratic ease-out.
const FLASH_MS = 300;
// Peak vs crossing speed: Lenis |velocity| ≈ 25+ (a committed flick) reaches the
// full peak; the 0.35 floor keeps a slow, deliberate crossing legible as an
// event without washing the frame. Tune K on a real-GPU run.
const FLASH_VELOCITY_K = 0.04;
const FLASH_PEAK_MIN = 0.35;
// Cap so even a max-velocity flash still reads the scene through it, never a
// solid colour wash.
const FLASH_OPACITY_MAX = 0.72;

export function Transitions() {
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const st = useExperience.getState();
    const evt = st.lastBoundary;
    if (!evt || st.reducedMotion) {
      mesh.visible = false;
      return;
    }
    const t = (performance.now() - evt.at) / FLASH_MS;
    if (t >= 1) {
      mesh.visible = false;
      return;
    }
    const env = (1 - t) * (1 - t);
    const peak = clamp(evt.velocity * FLASH_VELOCITY_K, FLASH_PEAK_MIN, 1);
    mesh.visible = true;

    // Ride in front of the camera, square to it (billboard).
    camera.getWorldDirection(_fwd);
    mesh.position.copy(camera.position).addScaledVector(_fwd, 6);
    mesh.quaternion.copy(camera.quaternion);

    // Tint = the INCOMING dimension: the deeper neighbour when diving (+1), the
    // shallower one when scrolling back (-1). Boundary i bridges dims i / i+1.
    const incoming = evt.direction > 0 ? evt.index + 1 : evt.index;
    mat.color.set(ZONES[clamp(incoming, 0, ZONES.length - 1)].color);
    mat.opacity = env * peak * FLASH_OPACITY_MAX;
    const s = 5 + env * peak * 13;
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
