import * as THREE from "three";

/**
 * The single authored path the one camera dives along (spec §3.1). Centralizing
 * the keyframes here (spec §10 — no magic numbers in motion) lets the Rig and the
 * scene visuals agree on where each "dimension" lives. M2's DimensionManager will
 * read the same ZONES to know which scene is active / incoming.
 */

export type ServiceCategory = "power" | "structure" | "smart";

export interface ZoneDef {
  index: number;
  name: string;
  category: ServiceCategory;
  color: string;
  position: THREE.Vector3;
}

// Colour encodes service category (spec §6).
const COLOR: Record<ServiceCategory, string> = {
  power: "#e8a23d", // power / electrical (dims 1, 5, 6)
  structure: "#8a94a6", // structure / build (dims 2, 3)
  smart: "#43d0c4", // smart systems (dim 4)
};

/**
 * Six zones marching into the scene along −Z (the dominant "dive" axis) with
 * gentle lateral drift for cinematic life. The camera passes through each
 * gateway's centre, so the gateway sits exactly on its zone point.
 */
export const ZONES: ZoneDef[] = [
  { index: 0, name: "THE CITY", category: "power", color: COLOR.power, position: new THREE.Vector3(3, 1, -30) },
  { index: 1, name: "THE BUILDING", category: "structure", color: COLOR.structure, position: new THREE.Vector3(-3, -1.5, -66) },
  { index: 2, name: "THE FRAME", category: "structure", color: COLOR.structure, position: new THREE.Vector3(2.5, 2, -102) },
  { index: 3, name: "THE ROOM", category: "smart", color: COLOR.smart, position: new THREE.Vector3(-2, -2, -138) },
  { index: 4, name: "THE WIRING", category: "power", color: COLOR.power, position: new THREE.Vector3(1.5, 1, -174) },
  { index: 5, name: "THE CURRENT", category: "power", color: COLOR.power, position: new THREE.Vector3(0, 0, -210) },
];

/** Where the camera starts before the first zone (the "powering on" framing). */
export const CAMERA_START = new THREE.Vector3(0, 0, 8);

/**
 * Centripetal Catmull-Rom avoids cusps/self-intersections, giving a smooth
 * fly-through. Arc-length sampling via getPointAt() keeps travel speed even
 * so scroll pacing reads as steady rather than lurching between control points.
 */
// The camera dives THROUGH zones 1–5, then ends a few units *in front of* the
// final zone (THE CURRENT) so at progress 1 its glowing gateway fills the view —
// the climax framing, and the correct entry state for the M3 loop back to the
// city — rather than overshooting it into the void.
const FINAL_APPROACH = ZONES[ZONES.length - 1].position
  .clone()
  .add(new THREE.Vector3(0, 0, 7));

export const CAMERA_PATH = new THREE.CatmullRomCurve3(
  [
    CAMERA_START,
    ...ZONES.slice(0, -1).map((z) => z.position.clone()),
    FINAL_APPROACH,
  ],
  false,
  "centripetal",
  0.5,
);

// --- Boundary / transition math (spec §3.2: the "moment of impact") ---------
// The path is arc-length parameterised, so the progress at which the camera sits
// at each zone is NOT evenly spaced — compute it by sampling depth.
const _sample = new THREE.Vector3();
function computeZoneProgress(): number[] {
  return ZONES.map((zone) => {
    let bestP = 0;
    let bestD = Infinity;
    for (let s = 0; s <= 240; s++) {
      const p = s / 240;
      CAMERA_PATH.getPointAt(p, _sample);
      const d = Math.abs(_sample.z - zone.position.z);
      if (d < bestD) {
        bestD = d;
        bestP = p;
      }
    }
    return bestP;
  });
}

/** Progress (0..1) where the camera sits at each zone. */
export const ZONE_PROGRESS = computeZoneProgress();

/** Progress of each of the 5 boundaries (midpoint between consecutive zones). */
export const BOUNDARY_PROGRESS = ZONE_PROGRESS.slice(0, -1).map(
  (p, i) => (p + ZONE_PROGRESS[i + 1]) / 2,
);

/** Width (in progress) of the transition pulse around a boundary. */
export const BOUNDARY_EPS = 0.045;

/**
 * The "moment of impact" primitive — the single source of truth every transition
 * visual reads. Returns a Gaussian `pulse` (0..1) that peaks as `progress` crosses
 * a boundary, plus the dimensions it bridges. Pure: call it in useFrame, never
 * store per-frame.
 */
export function boundaryPulse(progress: number): {
  pulse: number;
  fromIndex: number;
  toIndex: number;
} {
  let best = 0;
  let bi = 0;
  for (let i = 0; i < BOUNDARY_PROGRESS.length; i++) {
    const d = (progress - BOUNDARY_PROGRESS[i]) / BOUNDARY_EPS;
    const g = Math.exp(-d * d);
    if (g > best) {
      best = g;
      bi = i;
    }
  }
  return { pulse: best, fromIndex: bi, toIndex: bi + 1 };
}

// Dev-only: expose for headless numeric verification of the boundary math.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __boundary?: unknown }).__boundary = {
    ZONE_PROGRESS,
    BOUNDARY_PROGRESS,
    BOUNDARY_EPS,
    pulse: boundaryPulse,
  };
}
