import * as THREE from "three";
import { KEYFRAMES, ZONES } from "../cameraPath";
import type { QualityTier } from "@/src/store/useExperience";

/**
 * Dimension 6 helpers — the Current's filament field + the match-cut formation.
 *
 * Everything here is DETERMINISTIC (mulberry32, fixed seeds): the camera cores
 * straight through this cloud, so the layout is authored-by-seed, reproducible
 * across visits/tiers, and a regression can never hide behind a lucky roll.
 *
 * Geometry/shader contract: base `position` is a static cylindrical distribution;
 * ALL motion lives in the vertex shader as a function of CPU-integrated PHASE
 * uniforms (uFlow/uSwirl). Integrating phase on the CPU (instead of speed×time in
 * the shader) means a scroll-velocity surge changes the *derivative* of motion,
 * never the position — no teleporting particles on a wheel flick.
 */

// --- Counts & tiers ----------------------------------------------------------

/** Full-tier particle counts (primary warm stream / secondary cool harmonic). */
export const PRIMARY_FULL = 650;
export const SECONDARY_FULL = 280;
/** Tier scaling per the quality table (§7): full 1× / reduced 0.5× / minimal 0.25×. */
const TIER_SCALE: Record<QualityTier, number> = { full: 1, reduced: 0.5, minimal: 0.25 };

/** Length of the flow tube along z — particles loop within this. */
export const SPAN = 44;

// The scene group's world position — single source shared with CurrentScene so the
// formation math (computed in group-local space) can never drift from the JSX.
const ANCHOR = ZONES[ZONES.length - 1].position;
export const GROUP_POSITION: [number, number, number] = [ANCHOR.x, ANCHOR.y, ANCHOR.z - 6];

// --- Seeded RNG ---------------------------------------------------------------

/** mulberry32 — tiny deterministic PRNG; same seed ⇒ same field, every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- GLSL ---------------------------------------------------------------------

/**
 * Shared vertex chunk. `flowPos` is a pure function of phase, so the SAME function
 * evaluated at a lagged phase yields the tail of a streak — filaments bend along
 * the actual flight path (swirl + drift included), not a straight screen smear.
 * The drift terms are "curl-ish": two incommensurate depth-keyed sine bands per
 * axis, cheap and visually divergence-free, so streams braid instead of translating
 * as a rigid tube. The z-wrap discontinuity in the drift happens at z=+span/2 —
 * BEHIND the parked camera (local z ≥ +8) — so the respawn pop is never on screen.
 */
const FLOW_CHUNK = /* glsl */ `
  uniform float uFlow;   // integrated flow phase (CPU: += dt * flowSpeed)
  uniform float uSwirl;  // integrated swirl/drift phase (slower, mildly velocity-coupled)
  uniform float uForm;   // 0 = free flow field → 1 = skyline-window formation (match-cut)
  uniform float uRate;   // per-layer speed multiplier (secondary harmonic = 0.45)
  attribute float aSeed;
  attribute vec3 aTarget; // assigned skyline-window slot (group-local, seeded)

  vec3 flowPos(float flowPhase, float swirlPhase) {
    float span = ${SPAN.toFixed(1)};
    vec3 p = position;
    // Stream toward the viewer (+z); per-particle speed (1+seed)×, looping in span.
    p.z = mod(position.z + flowPhase * (1.0 + aSeed) + aSeed * span, span) - span * 0.5;
    // Slow orbital swirl around the core.
    float ang = swirlPhase + aSeed * 6.2831;
    p.xy += vec2(cos(ang), sin(ang)) * (0.5 * aSeed);
    // Curl-ish lateral drift — streams meander and braid, not just translate.
    p.x += sin(p.z * 0.34 + swirlPhase * 1.6 + aSeed * 9.4) * (0.35 + 0.45 * aSeed);
    p.y += cos(p.z * 0.23 - swirlPhase * 1.2 + aSeed * 17.3) * (0.30 + 0.40 * aSeed);
    return p;
  }

  // Staggered settle: low-seed leaders peel into the skyline first, stragglers
  // stream on — the formation ASSEMBLES rather than snapping into place.
  float settleAmount() {
    return smoothstep(0.0, 1.0, clamp((uForm - aSeed * 0.35) / 0.65, 0.0, 1.0));
  }
`;

export const POINT_VERT = /* glsl */ `
  ${FLOW_CHUNK}
  uniform float uDpr;
  varying float vSeed;
  varying float vSettle;
  void main() {
    vSeed = aSeed;
    float settle = settleAmount();
    vSettle = settle;
    vec3 p = mix(flowPos(uFlow * uRate, uSwirl * uRate), aTarget, settle);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // gl_PointSize is in DEVICE pixels — multiply uDpr so a DPR-2 phone renders the
    // same physical size as DPR-1 (the P0-adjacent sizing bug). Settled particles
    // steady down to a calm window-dot; capped so a near-plane flyby never flashes
    // a frame-filling sprite (the flow passes right through the camera plane).
    float size = (300.0 / max(-mv.z, 0.1)) * (0.4 + aSeed * 0.9);
    size *= mix(1.0, 0.55 + 0.2 * aSeed, settle);
    gl_PointSize = min(size, 64.0) * uDpr;
  }
`;

export const POINT_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uFormColor;
  varying float vSeed;
  varying float vSettle;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r);
    // Electric → window-amber as the formation settles (the match-cut tint shift).
    // HDR multiplier feeds bloom directly (ShaderMaterial bypasses tone mapping —
    // same pure-glow class as the toneMapped:false light cards).
    vec3 col = mix(uColor, uFormColor, vSettle) * (1.3 + vSeed * 1.2);
    gl_FragColor = vec4(col * a, a);
  }
`;

export const LINE_VERT = /* glsl */ `
  ${FLOW_CHUNK}
  uniform float uTailLag; // phase lag head→tail (∝ flow speed ⇒ streak length ∝ speed)
  attribute float aHead;  // 1 = head vertex, 0 = tail vertex
  varying float vSeed;
  varying float vSettle;
  varying float vHead;
  void main() {
    vSeed = aSeed;
    vHead = aHead;
    float settle = settleAmount();
    vSettle = settle;
    // The tail is the SAME path a moment ago — lag collapses to zero as the
    // particle settles, so streaks resolve into still window points at the seam.
    float lag = uTailLag * (1.0 - aHead) * (1.0 - settle);
    vec3 p = mix(flowPos((uFlow - lag) * uRate, (uSwirl - lag * 0.07) * uRate), aTarget, settle);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const LINE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uFormColor;
  varying float vSeed;
  varying float vSettle;
  varying float vHead;
  void main() {
    // Taper: bright head, fading tail. Lines hand brightness off to the point
    // heads as the formation settles (a window is a dot, not a streak).
    float a = mix(0.12, 0.85, vHead) * (1.0 - vSettle * 0.85);
    vec3 col = mix(uColor, uFormColor, vSettle) * (1.1 + vSeed * 1.1);
    gl_FragColor = vec4(col * a, a);
  }
`;

// --- Uniforms -----------------------------------------------------------------

/**
 * Uniform SOURCE factory. R3F v9 CLONES the object passed to
 * `<shaderMaterial uniforms={…}>` — these objects only seed initial values; all
 * runtime writes go through the material ref (`mat.uniforms.X.value`). One shared
 * shape for points AND lines (unused entries are inactive in the program and
 * three.js skips them) so the per-frame write loop stays branch-free.
 */
export function makeCurrentUniforms(color: string, formColor: string, rate: number) {
  return {
    uFlow: { value: 0 },
    uSwirl: { value: 0 },
    uTailLag: { value: 0 },
    uForm: { value: 0 },
    uDpr: { value: 1 },
    uRate: { value: rate },
    uColor: { value: new THREE.Color(color) },
    uFormColor: { value: new THREE.Color(formColor) },
  };
}

// --- The skyline-window formation (the match-cut signature) -------------------

/** Distance ahead of the final parked camera where the skyline assembles. */
const FORMATION_DIST = 22;
/** Slots are allocated at FULL-tier totals; tiers index a prefix of the same array. */
const SLOT_TARGET = PRIMARY_FULL + SECONDARY_FULL;

let slotCache: Float32Array | null = null;

/**
 * Precompute the amber "distant lit tower windows" formation, group-local, seeded.
 * Placement is derived from the LAST authored keyframe (read-only): centered on its
 * lookAt direction, FORMATION_DIST ahead — so if the climax framing is ever retuned,
 * the skyline follows the camera automatically. Five depth ranks of tower window
 * grids (columns/rows, ~26% dark windows = gaps, jittered ±0.08) read as a city at
 * night; tower silhouettes emerge from the column gaps, exactly the CityScene trick.
 * Frame check (FOV 55): half-height at dist 22 ≈ 11.4, half-width ≈ 20 — towers span
 * x ±18.5, y −7.5..+11, back ranks taller and deeper (parallax skyline depth).
 */
function buildFormationSlots(): Float32Array {
  const rng = mulberry32(0x5c111e); // authored constant — the skyline is designed, not rolled
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  const dir = last.lookAt.clone().sub(last.position).normalize();
  const center = last.position
    .clone()
    .addScaledVector(dir, FORMATION_DIST)
    .sub(new THREE.Vector3(GROUP_POSITION[0], GROUP_POSITION[1], GROUP_POSITION[2]));
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();

  const HALF_W = 16.5;
  const BASE_Y = -7.5; // street level sits low in the frame, like the City vista
  const COL_S = 0.8;
  const ROW_S = 0.92;
  const slots: number[] = [];
  const v = new THREE.Vector3();

  for (let rank = 0; rank < 5 && slots.length < SLOT_TARGET * 3; rank++) {
    const depth = rank * 3.0; // deeper rank = further along the look direction
    let x = -HALF_W + rng() * 2.0;
    while (x < HALF_W - 2.0) {
      const cols = 3 + Math.floor(rng() * 3); // 3..5 window columns per tower
      const rows = 6 + Math.floor(rng() * Math.min(9 + rank * 3, 14)); // back towers peek over
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() >= 0.74) continue; // dark windows — the gaps that make it READ
          const wx = x + c * COL_S + (rng() - 0.5) * 0.08;
          const wy = BASE_Y + r * ROW_S + (rng() - 0.5) * 0.08;
          const wd = depth + (rng() - 0.5) * 0.5;
          v.copy(center).addScaledVector(right, wx).addScaledVector(up, wy).addScaledVector(dir, wd);
          slots.push(v.x, v.y, v.z);
        }
      }
      x += cols * COL_S + 0.9 + rng() * 1.8; // gap between towers = silhouette edges
    }
  }
  // Guard: if the roll lands short, double up earlier windows (two particles on one
  // window just reads brighter — invisible as a failure mode).
  while (slots.length < SLOT_TARGET * 3) {
    const i = Math.floor(rng() * (slots.length / 3)) * 3;
    slots.push(slots[i], slots[i + 1], slots[i + 2]);
  }
  // Deterministic shuffle so ANY prefix (the 0.5×/0.25× tier subsets) still spans
  // the whole skyline — minimal tier gets a sparser city, never a cropped one.
  const triplets = slots.length / 3;
  for (let i = triplets - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    for (let k = 0; k < 3; k++) {
      const a = i * 3 + k;
      const b = j * 3 + k;
      const tmp = slots[a];
      slots[a] = slots[b];
      slots[b] = tmp;
    }
  }
  return new Float32Array(slots);
}

function formationSlots(): Float32Array {
  if (!slotCache) slotCache = buildFormationSlots();
  return slotCache;
}

// --- Geometry builders ----------------------------------------------------------

/**
 * Static base positions span the flow tube, but the shader moves particles up to
 * the formation (x ±18.5, z −26) — set an explicit generous bounding sphere so
 * frustum culling stays correct in BOTH states (and still culls the whole system
 * when the camera is dimensions away).
 */
function withBounds(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -4), 34);
  return g;
}

interface FlowField {
  base: Float32Array;
  seed: Float32Array;
}

/** Cylindrical distribution, denser toward the core (r = rng·rng·maxR), z across SPAN. */
function buildFlowField(count: number, maxR: number, rng: () => number): FlowField {
  const base = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * rng() * maxR;
    base[i * 3] = Math.cos(a) * r;
    base[i * 3 + 1] = Math.sin(a) * r;
    base[i * 3 + 2] = (rng() - 0.5) * SPAN;
    seed[i] = rng();
  }
  return { base, seed };
}

/** Point heads: one vertex per particle (base + seed + assigned formation slot). */
function buildPointsGeometry(f: FlowField, slots: Float32Array, slotOffset: number): THREE.BufferGeometry {
  const n = f.seed.length;
  const target = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = (slotOffset + i) * 3;
    target[i * 3] = slots[s];
    target[i * 3 + 1] = slots[s + 1];
    target[i * 3 + 2] = slots[s + 2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(f.base, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(f.seed, 1));
  g.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
  return withBounds(g);
}

/**
 * Filament streaks: TWO vertices per particle (head aHead=1, tail aHead=0) drawn as
 * LineSegments; the vertex shader stretches the tail back along the flow path.
 * Vertex order [head, tail] per consecutive pair = gl.LINES pairing.
 */
function buildLinesGeometry(f: FlowField, slots: Float32Array, slotOffset: number): THREE.BufferGeometry {
  const n = f.seed.length;
  const pos = new Float32Array(n * 6);
  const seed = new Float32Array(n * 2);
  const head = new Float32Array(n * 2);
  const target = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const s = (slotOffset + i) * 3;
    for (let vtx = 0; vtx < 2; vtx++) {
      const j = i * 2 + vtx;
      pos[j * 3] = f.base[i * 3];
      pos[j * 3 + 1] = f.base[i * 3 + 1];
      pos[j * 3 + 2] = f.base[i * 3 + 2];
      seed[j] = f.seed[i];
      head[j] = vtx === 0 ? 1 : 0;
      target[j * 3] = slots[s];
      target[j * 3 + 1] = slots[s + 1];
      target[j * 3 + 2] = slots[s + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aHead", new THREE.BufferAttribute(head, 1));
  g.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
  return withBounds(g);
}

// --- Assembled per-tier assets ---------------------------------------------------

export interface CurrentAssets {
  primaryPoints: THREE.BufferGeometry;
  primaryLines: THREE.BufferGeometry;
  secondaryPoints: THREE.BufferGeometry;
  secondaryLines: THREE.BufferGeometry;
  dispose(): void;
}

/**
 * Build the four geometries for a quality tier. Fixed seeds per layer: the SAME
 * particles exist on every tier (a tier is a deterministic prefix, not a re-roll).
 * Secondary slots start at the FULL primary offset so the two layers never share a
 * window regardless of tier. Caller owns disposal (rebuilt only on tier change —
 * a rare one-off; `renderer.info.memory` must stay flat across the loop).
 */
export function buildCurrentAssets(quality: QualityTier): CurrentAssets {
  const scale = TIER_SCALE[quality];
  const slots = formationSlots();
  const pf = buildFlowField(Math.round(PRIMARY_FULL * scale), 6.5, mulberry32(0xe1ec01));
  const sf = buildFlowField(Math.round(SECONDARY_FULL * scale), 3.2, mulberry32(0xe1ec02));
  const primaryPoints = buildPointsGeometry(pf, slots, 0);
  const primaryLines = buildLinesGeometry(pf, slots, 0);
  const secondaryPoints = buildPointsGeometry(sf, slots, PRIMARY_FULL);
  const secondaryLines = buildLinesGeometry(sf, slots, PRIMARY_FULL);
  return {
    primaryPoints,
    primaryLines,
    secondaryPoints,
    secondaryLines,
    dispose() {
      primaryPoints.dispose();
      primaryLines.dispose();
      secondaryPoints.dispose();
      secondaryLines.dispose();
    },
  };
}
