import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { ZONES, ZONE_PROGRESS } from "./cameraPath";
import { clamp, remap } from "@/src/lib/math";

/**
 * Continuous per-layer atmosphere (spec §6.2): the fog tint + background shift
 * through the service-category palette as the camera dives, so each dimension
 * feels like a different "era" while staying one continuous night world. Driven
 * by the single scroll value — interpolated every frame, never authored per-cut.
 */

const NIGHT = new THREE.Color("#05070d");
// Each zone's fog tint = its category colour pulled most of the way to night.
// The Room (dim 3) is special-cased to a DARK WARM interior rather than its teal
// category colour — the teal is the smart-device ACCENT (§7), not a full-frame
// wash, so the warm-lit furniture actually reads instead of drowning in teal.
const FOG_TINTS = ZONES.map((z, i) =>
  i === 3
    ? new THREE.Color("#161009")
    : i === 1 || i === 2
      ? // Structure zones (Building, Frame): the old lerp 0.8 gave a luminous
        // blue-GRAY (~#20232c) — the milky haze the owner saw. Sink them to cool
        // near-night so the lit subject carries the frame.
        new THREE.Color("#0b0f17")
      : // Power / smart zones: deeper night (0.92) but a faint category hue remains.
        new THREE.Color(z.color).lerp(NIGHT, 0.92),
);

const _fog = new THREE.Color();
const _bg = new THREE.Color();

export function Atmosphere() {
  const scene = useThree((s) => s.scene);

  useFrame(() => {
    const p = useExperience.getState().progress;
    // PIECEWISE REMAP THROUGH THE AUTHORED ARRIVALS: the camera parks at
    // ZONE_PROGRESS [0.13, 0.29, …, 0.93], NOT at uniform i/(N-1) spacing. The
    // old uniform mapping made the atmosphere lead the camera by up to half a
    // dimension (at the held City arrival the amber fog was already 65% Building
    // blue). Each tint pair now interpolates exactly between its bracketing
    // arrivals; clamped flat before the first and after the last, so the parked
    // frames hold their own atmosphere.
    const last = ZONE_PROGRESS.length - 1;
    let i = 0;
    for (let j = 1; j < last; j++) {
      if (p >= ZONE_PROGRESS[j]) i = j;
    }
    const t = clamp(remap(p, ZONE_PROGRESS[i], ZONE_PROGRESS[i + 1], 0, 1), 0, 1);
    const next = i + 1;

    _fog.copy(FOG_TINTS[i]).lerp(FOG_TINTS[next], t);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(_fog);
    if (scene.background instanceof THREE.Color) {
      _bg.copy(_fog).multiplyScalar(0.18);
      scene.background.copy(_bg);
    }
  });

  return null;
}
