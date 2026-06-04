import * as THREE from "three";

/**
 * The single camera's motion is AUTHORED, not curve-derived (spec §3.1).
 *
 * Earlier the camera read its position from a Catmull-Rom curve and its
 * ORIENTATION from that curve's tangent (lookAt = pos + tangent). Because the
 * path drifts laterally between zones, the tangent swings — so the camera yawed
 * and pitched as it tracked the curve and never deliberately framed a scene.
 *
 * Instead we hand-author keyframes of {progress, position, lookAt} — where the
 * camera IS and what it AIMS AT — and sample them by the scroll progress with
 * cubic-Hermite interpolation. progress IS the interpolation parameter, so every
 * keyframe is hit EXACTLY at its authored progress (no arc-length remap), and the
 * framing of each dimension is exactly what we placed. Motion is cinematic but
 * controlled: descend into the City, approach the Building head-on, fly through
 * the Frame, look down into the Room, travel among the Wiring, core the Current.
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
 * gentle lateral drift for cinematic life. Each scene anchors its content at its
 * zone position; the authored camera keyframes below frame those anchors.
 */
export const ZONES: ZoneDef[] = [
  { index: 0, name: "THE CITY", category: "power", color: COLOR.power, position: new THREE.Vector3(3, 1, -30) },
  { index: 1, name: "THE BUILDING", category: "structure", color: COLOR.structure, position: new THREE.Vector3(-3, -1.5, -66) },
  { index: 2, name: "THE FRAME", category: "structure", color: COLOR.structure, position: new THREE.Vector3(2.5, 2, -102) },
  { index: 3, name: "THE ROOM", category: "smart", color: COLOR.smart, position: new THREE.Vector3(-2, -2, -138) },
  { index: 4, name: "THE WIRING", category: "power", color: COLOR.power, position: new THREE.Vector3(1.5, 1, -174) },
  { index: 5, name: "THE CURRENT", category: "power", color: COLOR.power, position: new THREE.Vector3(0, 0, -210) },
];

// --- Authored camera keyframes ----------------------------------------------

export interface CamKey {
  /** 0..1 scroll progress. MUST be strictly ascending (bracket-search invariant). */
  progress: number;
  /** Authored camera position. */
  position: THREE.Vector3;
  /** Authored focal point the camera aims at. */
  lookAt: THREE.Vector3;
  /**
   * Zero-tangent at this key: the camera eases to a momentary rest here (a held
   * "arrival" frame) and the look-aim stops swinging — also the overshoot guard
   * on the sharpest turns. Set on the 6 arrival keys.
   */
  park?: boolean;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * 13 keys: a start vista + an (approach, held-arrival) pair per dimension + a
 * loop-linger. The park'd arrival keys give the "decelerate-in / accelerate-out"
 * beat. Numbers are grounded against each scene file (Building FACADE_Z=-69;
 * Frame cage z≈-108..-96, H=30; Room FLOOR_Y=-5, cluster ≈(-2,floor,-138);
 * Wiring tubes z -204..-144; Current points at (0,0,-216) r≤6.5). Tune from
 * real-GPU captures, not by eye.
 */
export const KEYFRAMES: CamKey[] = [
  { progress: 0.0, position: v(3, 20, 6), lookAt: v(3, 2, -25) }, // 0 high above City, descending in
  { progress: 0.13, position: v(3, 16, -4), lookAt: v(3, -1, -32), park: true }, // 1 CITY — overhead skyline (y clears tallest towers ≈15)
  { progress: 0.22, position: v(0, 4, -42), lookAt: v(-3, -1, -66) }, // 2 Building approach
  { progress: 0.29, position: v(-3, -1.5, -52), lookAt: v(-3, -1.5, -69), park: true }, // 3 BUILDING — head-on facade
  { progress: 0.38, position: v(2.5, 2, -88), lookAt: v(2.5, 2, -104) }, // 4 Frame approach (cage mouth)
  { progress: 0.45, position: v(2.5, 2, -100), lookAt: v(2.5, 2, -116), park: true }, // 5 FRAME — mid-cage fly-through
  { progress: 0.54, position: v(0, 4.5, -119), lookAt: v(-2, -2.5, -134) }, // 6 Room approach — descending in
  { progress: 0.61, position: v(-1, 1.8, -129), lookAt: v(-3, -3.5, -138), park: true }, // 7 ROOM — furniture in 3/4 view (look at body height, gentle ~28° down)
  { progress: 0.7, position: v(1.5, 1.5, -158), lookAt: v(1.5, 1, -180) }, // 8 Wiring approach (into bundle)
  { progress: 0.77, position: v(1.5, 1, -172), lookAt: v(1.5, 1, -196) }, // 9 WIRING — among the tubes
  { progress: 0.86, position: v(0, 0, -196), lookAt: v(0, 0, -216) }, // 10 Current approach (coring in)
  { progress: 0.93, position: v(0, 0, -204), lookAt: v(0, 0, -216), park: true }, // 11 CURRENT — climax
  { progress: 1.0, position: v(0, 0, -208), lookAt: v(0, 0, -216) }, // 12 loop linger (veil goes opaque)
];

// Reusable temporaries — sampleCamera runs every frame, never allocate (spec §10).
const _m0 = new THREE.Vector3();
const _m1 = new THREE.Vector3();
const _m0l = new THREE.Vector3();
const _m1l = new THREE.Vector3();

/**
 * Catmull-Rom auto-tangent for key `i`, written to `out`. Centered difference
 * over the neighbours (one-sided at the ends); a park'd key gets a zero tangent
 * so the segments either side ease into / out of it. `look` selects the channel.
 */
function keyTangent(out: THREE.Vector3, i: number, look: boolean): void {
  const k = KEYFRAMES;
  if (k[i].park) {
    out.set(0, 0, 0);
    return;
  }
  const cur = look ? k[i].lookAt : k[i].position;
  if (i === 0) {
    out.subVectors(look ? k[1].lookAt : k[1].position, cur);
  } else if (i === k.length - 1) {
    out.subVectors(cur, look ? k[i - 1].lookAt : k[i - 1].position);
  } else {
    out
      .subVectors(look ? k[i + 1].lookAt : k[i + 1].position, look ? k[i - 1].lookAt : k[i - 1].position)
      .multiplyScalar(0.5);
  }
}

/** Cubic-Hermite blend of two endpoint vectors + their tangents into `out`. */
function hermite(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  m0: THREE.Vector3,
  m1: THREE.Vector3,
  t: number,
): void {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  out.set(
    h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
    h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
    h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z,
  );
}

/**
 * Sample the authored camera at scroll progress `p`, writing the camera position
 * to `outPos` and its look-at target to `outLook`. Exact at every keyframe
 * (t=0/1 reduce to the endpoints) and clamped verbatim past the ends so the
 * opening vista (p=0) and climax (p=1) are precisely what we authored.
 */
export function sampleCamera(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3): void {
  const k = KEYFRAMES;
  const n = k.length;
  if (p <= k[0].progress) {
    outPos.copy(k[0].position);
    outLook.copy(k[0].lookAt);
    return;
  }
  if (p >= k[n - 1].progress) {
    outPos.copy(k[n - 1].position);
    outLook.copy(k[n - 1].lookAt);
    return;
  }
  let i = 0;
  for (let j = 0; j < n - 1; j++) {
    if (p >= k[j].progress && p < k[j + 1].progress) {
      i = j;
      break;
    }
  }
  const k0 = k[i];
  const k1 = k[i + 1];
  const t = (p - k0.progress) / (k1.progress - k0.progress);

  keyTangent(_m0, i, false);
  keyTangent(_m1, i + 1, false);
  hermite(outPos, k0.position, k1.position, _m0, _m1, t);

  keyTangent(_m0l, i, true);
  keyTangent(_m1l, i + 1, true);
  hermite(outLook, k0.lookAt, k1.lookAt, _m0l, _m1l, t);
}

// --- Boundary / transition math (spec §3.2: the "moment of impact") ---------

/**
 * Progress (0..1) where the camera sits at each zone — now EXPLICIT: the six
 * park'd "arrival" keys. Single source of truth, so retuning an arrival key's
 * progress auto-updates the Hud ticks and the boundary math below.
 */
export const ZONE_PROGRESS = [1, 3, 5, 7, 9, 11].map((i) => KEYFRAMES[i].progress);

/** Progress of each of the 5 boundaries (midpoint between consecutive zones). */
export const BOUNDARY_PROGRESS = ZONE_PROGRESS.slice(0, -1).map(
  (pr, i) => (pr + ZONE_PROGRESS[i + 1]) / 2,
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

// Dev-only: verify the keyframe ordering invariant + expose boundary math for
// headless numeric checks. Stripped from production builds.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  for (let i = 1; i < KEYFRAMES.length; i++) {
    if (KEYFRAMES[i].progress <= KEYFRAMES[i - 1].progress) {
      console.error(
        `[cameraPath] KEYFRAMES.progress must be strictly ascending — broken at index ${i} ` +
          `(${KEYFRAMES[i - 1].progress} → ${KEYFRAMES[i].progress})`,
      );
    }
  }
  (window as unknown as { __boundary?: unknown }).__boundary = {
    ZONE_PROGRESS,
    BOUNDARY_PROGRESS,
    BOUNDARY_EPS,
    pulse: boundaryPulse,
  };
  // Verification hook: the authored framing at any progress, as plain numbers, so
  // scripts/verify-dive.py can assert the live camera matches it (position AND the
  // orientation invariant) without duplicating the keyframe table.
  const _vp = new THREE.Vector3();
  const _vl = new THREE.Vector3();
  (window as unknown as { __sampleCamera?: unknown }).__sampleCamera = (p: number) => {
    sampleCamera(p, _vp, _vl);
    return {
      pos: { x: _vp.x, y: _vp.y, z: _vp.z },
      look: { x: _vl.x, y: _vl.y, z: _vl.z },
    };
  };
}
