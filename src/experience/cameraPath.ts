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
