import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { ZONES } from "./cameraPath";
import { clamp } from "@/src/lib/math";

/**
 * Continuous per-layer atmosphere (spec §6.2): the fog tint + background shift
 * through the service-category palette as the camera dives, so each dimension
 * feels like a different "era" while staying one continuous night world. Driven
 * by the single scroll value — interpolated every frame, never authored per-cut.
 */

const NIGHT = new THREE.Color("#05070d");
// Each zone's fog tint = its category colour pulled most of the way to night,
// so the world stays dark but takes on the dimension's mood.
const FOG_TINTS = ZONES.map((z) => new THREE.Color(z.color).lerp(NIGHT, 0.8));

const _fog = new THREE.Color();
const _bg = new THREE.Color();

export function Atmosphere() {
  const scene = useThree((s) => s.scene);

  useFrame(() => {
    const p = useExperience.getState().progress;
    const f = clamp(p * (ZONES.length - 1), 0, ZONES.length - 1);
    const i = Math.floor(f);
    const t = f - i;
    const next = Math.min(i + 1, ZONES.length - 1);

    _fog.copy(FOG_TINTS[i]).lerp(FOG_TINTS[next], t);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(_fog);
    if (scene.background instanceof THREE.Color) {
      _bg.copy(_fog).multiplyScalar(0.55);
      scene.background.copy(_bg);
    }
  });

  return null;
}
