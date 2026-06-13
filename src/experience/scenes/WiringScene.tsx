import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";

/**
 * Dimension 5 — Inside the Wall: Wiring & Maintenance (spec §7).
 *
 * The camera now travels inside a REAL wall cavity, not a tube void: two long
 * drywall faces + a timber stud/noggin lattice give the conduits a place to
 * live; junction boxes and staple clamps make the run read as an INSTALLED,
 * maintained system. Every copper conductor carries a TRAVELING current pulse
 * (a comet band sweeping its u-coordinate, velocity-coupled) instead of the old
 * global sine that brightened every tube in unison — and all pulses flow toward
 * the hero breaker panel, into which five tubes physically CONVERGE (the story
 * beat: everything feeds the breaker).
 *
 * Layout rules (enforced, not hoped):
 * - Seeded randomness only (mulberry32): the tubes share space with the camera
 *   axis, so layout must be deterministic (briefing §5 prohibition — for many
 *   Math.random() seeds a tube crossed the axis and got near-plane sliced).
 * - Flight-line clearance: the camera runs along (1.5, 1, z) through this zone
 *   (cameraPath keys 8-9); every generated point within r<1.2 of that axis is
 *   pushed radially out to r=1.2, and tube materials are DoubleSide so a graze
 *   reads as solid insulation, not a hollow backface.
 * - Wall geometry never crosses the axis: faces sit at x-offsets −4.6/+8.4,
 *   studs hug the faces, noggins run along z at |Δy| ≥ 4.2, and clamps/boxes
 *   are skipped wherever the host point sits within r<2 of the axis.
 */

const A = ZONES[4].position; // (1.5, 1, -174)

// --- Deterministic layout RNG ------------------------------------------------
// Fixed seed = authored layout: same wall, same tubes, every load, every build.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xe1ec70);

// --- Flight-line clearance ----------------------------------------------------
const CLEAR_R = 1.2;
/** Push a point within r<1.2 of the camera axis (A.x, A.y, z) radially out. */
function clearXY(p: THREE.Vector3): THREE.Vector3 {
  const dx = p.x - A.x;
  const dy = p.y - A.y;
  const r = Math.hypot(dx, dy);
  if (r < CLEAR_R) {
    if (r < 1e-4) {
      p.x = A.x + CLEAR_R; // degenerate on-axis point: push +x deterministically
    } else {
      const s = CLEAR_R / r;
      p.x = A.x + dx * s;
      p.y = A.y + dy * s;
    }
  }
  return p;
}
const rXY = (p: THREE.Vector3) => Math.hypot(p.x - A.x, p.y - A.y);

// --- Hero breaker panel --------------------------------------------------------
// Rescaled 2.3× and pulled to ~9.8u from the (1.5, 1, -172) park (it was ~20u
// away at ~3% of frame). Off the flight line: left edge x≈3.18 → 1.68u clear.
const PS = 2.3;
const BOX = new THREE.Vector3(A.x + 4.9, A.y - 0.4, A.z - 6.5); // (6.4, 0.6, -180.5)
const PANEL_W = 2.8 * PS;
const PANEL_H = 3.6 * PS;
const PANEL_D = 1.1;
const PANEL_TOP = BOX.y + PANEL_H / 2;
const BREAKERS = 24;
// Live/standby indicator pattern — module-scope so StrictMode's double effect
// pass can't reroll it (effects below are pure placement, zero rand() calls).
const BREAKER_LIVE = Array.from({ length: BREAKERS }, () => rand() < 0.25);
const BRK_ON = new THREE.Color("#ffb24d");
const BRK_OFF = new THREE.Color("#4d9fff");

// Five feeds (3 insulated conduits + 2 live conductors) converge INTO the panel
// top — spread across its width, alternating depth so the drops don't z-fight.
const FEED_ENTRY = Array.from({ length: 5 }, (_, i) => ({
  x: BOX.x - 2.4 + i * 1.2,
  z: BOX.z - 0.3 + (i % 2) * 0.6,
}));

// --- Tube curves ----------------------------------------------------------------
const Z_STEP = 60 / 7; // free tubes span A.z+30 … A.z−30 (z linear in s)

function makeCurve(k: number, jitter: number): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const bx = A.x + (rand() - 0.5) * jitter;
  const by = A.y + (rand() - 0.5) * jitter;
  for (let s = 0; s <= 7; s++) {
    pts.push(
      clearXY(
        new THREE.Vector3(
          bx + Math.sin(s * 1.2 + k) * 1.4,
          by + Math.cos(s * 1.05 + k * 1.7) * 1.4,
          A.z + 30 - s * Z_STEP,
        ),
      ),
    );
  }
  return new THREE.CatmullRomCurve3(pts);
}

// Feed staging kinks double as junction-box anchors (boxes sit where runs turn).
const FEED_STAGES: THREE.Vector3[] = [];

function makeFeedCurve(
  k: number,
  jitter: number,
  entry: { x: number; z: number },
): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const bx = A.x + (rand() - 0.5) * jitter;
  const by = A.y + (rand() - 0.5) * jitter;
  for (let s = 0; s <= 3; s++) {
    pts.push(
      clearXY(
        new THREE.Vector3(
          bx + Math.sin(s * 1.2 + k) * 1.4,
          by + Math.cos(s * 1.05 + k * 1.7) * 1.4,
          A.z + 30 - s * Z_STEP,
        ),
      ),
    );
  }
  // Swing toward the panel, then drop vertically through its top face — the
  // visible convergence IS the story ("everything feeds the breaker").
  const wx = pts[3].x;
  const wy = pts[3].y;
  const stage = clearXY(
    new THREE.Vector3((wx + entry.x) / 2, wy + (PANEL_TOP + 2.6 - wy) * 0.65, A.z - 1),
  );
  FEED_STAGES.push(stage);
  pts.push(stage);
  pts.push(new THREE.Vector3(entry.x, PANEL_TOP + 1.5, entry.z));
  pts.push(new THREE.Vector3(entry.x, PANEL_TOP - 0.6, entry.z)); // sunk INTO the top
  return new THREE.CatmullRomCurve3(pts);
}

interface TubeDef {
  curve: THREE.CatmullRomCurve3;
  radius: number;
  feed: boolean;
}

const CONDUITS: TubeDef[] = Array.from({ length: 8 }, (_, k) => ({
  curve: k < 3 ? makeFeedCurve(k, 6.5, FEED_ENTRY[k * 2]) : makeCurve(k, 6.5),
  radius: 0.34 + rand() * 0.12,
  feed: k < 3,
}));
const COPPERS: TubeDef[] = Array.from({ length: 6 }, (_, k) => ({
  curve: k < 2 ? makeFeedCurve(k + 20, 3.8, FEED_ENTRY[k * 2 + 1]) : makeCurve(k + 20, 3.8),
  radius: 0.11 + rand() * 0.05,
  feed: k < 2,
}));

const CONDUIT_GEOMS = CONDUITS.map(
  (t) => new THREE.TubeGeometry(t.curve, 90, t.radius, 9, false),
);
const COPPER_GEOMS = COPPERS.map((t, i) => {
  const g = new THREE.TubeGeometry(t.curve, 90, t.radius, 8, false);
  // Per-conductor pulse stagger baked into u (the shader fract()-wraps it): six
  // tubes share ONE material/program, so the phase can't be a per-mesh uniform.
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) + i * 0.618);
  return g;
});

// --- Materials -------------------------------------------------------------------
// DoubleSide on the tubes: clearance-clamped grazes must read as solid
// insulation, not a hollow backface (P1 §4.3 #6b).
const CONDUIT_MAT = new THREE.MeshStandardMaterial({
  color: "#15110c",
  roughness: 0.85,
  metalness: 0.2,
  side: THREE.DoubleSide,
});
// Panel enclosure + junction boxes + clamps: enamelled steel — one "installed
// electrical kit" material so the system reads as a single product family.
const STEEL_MAT = new THREE.MeshStandardMaterial({
  color: "#2a3038",
  roughness: 0.55,
  metalness: 0.6,
});
// Albedos lifted off near-black so the cavity (drywall back + timber studs) is
// LEGIBLY PRESENT as the wall the wiring lives in — at p≈0.77 it was almost
// pure black around the tubes. A faint cool emissive floor (well under the 0.55
// bloom threshold) keeps the structure readable even in the deepest shadow,
// WITHOUT washing out the night mood or competing with the amber conduits.
const DRYWALL_MAT = new THREE.MeshStandardMaterial({
  color: "#1a1d24",
  emissive: "#10141c",
  emissiveIntensity: 0.5,
  roughness: 0.96,
  metalness: 0,
});
const TIMBER_MAT = new THREE.MeshStandardMaterial({
  color: "#2a2017",
  emissive: "#150f08",
  emissiveIntensity: 0.5,
  roughness: 0.9,
  metalness: 0.05,
});

// TRAVELING CURRENT (replaces the global sine that brightened every conductor in
// unison): three staggered comet bands sweep each tube's u-coordinate, flowing
// toward the panel (+u). The uniform lives in a module singleton which
// onBeforeCompile RE-LINKS on every (re)compile, and useFrame mutates only the
// singleton — the R3F v9 uniform-clone trap can't apply (no <shaderMaterial>
// uniforms prop involved) and an env/define-driven recompile can't orphan it.
const COPPER_UNIFORMS = { uPulseTime: { value: 0 } };
const COPPER_MAT = new THREE.MeshStandardMaterial({
  color: "#3a1e08",
  emissive: "#ff7a1f",
  emissiveIntensity: 1.0,
  toneMapped: true, // lit PBR copper goes through the AgX grade (briefing §4.3 #4)
  roughness: 0.45,
  metalness: 0.7,
  side: THREE.DoubleSide,
});
COPPER_MAT.onBeforeCompile = (shader) => {
  shader.uniforms.uPulseTime = COPPER_UNIFORMS.uPulseTime;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying float vTubeU;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvTubeU = uv.x;");
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying float vTubeU;\nuniform float uPulseTime;",
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
	{
		// Comet pulse: slow ramp behind (tail), sharp leading edge in the travel
		// direction (+u → the breaker panel). Peak ×3.5 clears the 0.55 bloom
		// threshold pre-tonemap; the 0.35 base keeps idle copper a dim ember.
		float f = fract(vTubeU * 3.0 - uPulseTime);
		float band = smoothstep(0.0, 0.30, f) * smoothstep(0.42, 0.34, f);
		totalEmissiveRadiance *= 0.35 + 3.2 * band;
	}`,
    );
};

// --- Electric arc sparks ---------------------------------------------------------
const SPARKS = 16;
// Seeded + clearance-clamped: a spark sphere parked on the axis would pop in the
// camera's face mid-flight.
const SPARK_POS = Array.from({ length: SPARKS }, () =>
  clearXY(
    new THREE.Vector3(
      A.x + (rand() - 0.5) * 7,
      A.y + (rand() - 0.5) * 7,
      A.z + (rand() - 0.5) * 56,
    ),
  ),
);
const SPARK_SCALE = Array.from({ length: SPARKS }, () => 0.05 + rand() * 0.09);
const _sd = new THREE.Object3D();
const _sc = new THREE.Color();
const ARC = new THREE.Color("#cfe6ff");

// --- Circuit-ID color bands ------------------------------------------------------
// Printed insulation, not party lights: the four primaries desaturated ~40% and
// capped at 0.5 peak channel (below the 0.55 bloom threshold), rendered THROUGH
// the grade (band material keeps toneMapped:true).
const BAND_COLORS = ["#ff4040", "#ffd23a", "#4071ff", "#46e06a"].map((hex) => {
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  c.lerp(new THREE.Color(l, l, l), 0.4);
  const peak = Math.max(c.r, c.g, c.b);
  if (peak > 0.5) c.multiplyScalar(0.5 / peak);
  return c;
});
const BAND_TS = [0.22, 0.4, 0.58, 0.76];
// Capacity derived from the data — the old literal 16 silently overflowed the
// 6 curves × 4 stations = 24 writes (8 bands were degenerate).
const BAND_CAP = COPPERS.length * BAND_TS.length;
const _bp = new THREE.Vector3();
const _bt = new THREE.Vector3();
const _bq = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const _bo = new THREE.Object3D();

// --- Wall cavity -------------------------------------------------------------------
// Asymmetric on purpose: the +x face sits deeper so the hero panel reads as
// flush-MOUNTED on it (panel right edge x≈9.62 vs face x=9.9). The mouth opens
// at z=-143 (the camera enters from the Room side at p≈0.66); the cavity ends at
// z=-195 where the Wiring→Current boundary flash masks the exit.
const WALL_X_NEG = A.x - 4.6;
const WALL_X_POS = A.x + 8.4;
const WALL_Y0 = A.y - 7;
const WALL_Y1 = A.y + 9;
const WALL_Z0 = A.z + 31;
const WALL_Z1 = A.z - 21;
const STUD_STEP = 4;
const STUD_X = [WALL_X_NEG + 0.3, WALL_X_POS - 0.3];
const MAX_LATTICE = 96;
const MAX_FITTINGS = 48;

// Lattice-builder temporaries (module-scope, reused — one scene, sequential).
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const _lm = new THREE.Vector3();
const _ld = new THREE.Vector3();
const _lq = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);

export function WiringScene() {
  const tier = TIERS[useExperience((s) => s.quality)];
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const bandRef = useRef<THREE.InstancedMesh>(null);
  const breakerRef = useRef<THREE.InstancedMesh>(null);
  const planeRef = useRef<THREE.InstancedMesh>(null);
  const latticeRef = useRef<THREE.InstancedMesh>(null);
  const fittingsRef = useRef<THREE.InstancedMesh>(null);
  const bright = useRef<number[]>([]);

  useLayoutEffect(() => {
    const m = sparkRef.current;
    if (m) {
      const b: number[] = [];
      for (let i = 0; i < SPARKS; i++) {
        _sd.position.copy(SPARK_POS[i]);
        _sd.scale.setScalar(SPARK_SCALE[i]);
        _sd.rotation.set(0, 0, 0);
        _sd.updateMatrix();
        m.setMatrixAt(i, _sd.matrix);
        _sc.setRGB(0, 0, 0);
        m.setColorAt(i, _sc);
        b.push(0);
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      bright.current = b;
    }

    // Color-coded circuit bands sampled along each copper conductor.
    const band = bandRef.current;
    if (band) {
      let i = 0;
      COPPERS.forEach((td, ci) => {
        BAND_TS.forEach((t, ti) => {
          td.curve.getPointAt(t, _bp);
          td.curve.getTangentAt(t, _bt);
          _bq.setFromUnitVectors(_Y, _bt); // cylinder axis (y) → tangent
          _bo.position.copy(_bp);
          _bo.quaternion.copy(_bq);
          _bo.scale.set(0.42, 0.16, 0.42);
          _bo.updateMatrix();
          band.setMatrixAt(i, _bo.matrix);
          band.setColorAt(i, BAND_COLORS[(ci + ti) % 4]);
          i++;
        });
      });
      band.count = i;
      band.instanceMatrix.needsUpdate = true;
      if (band.instanceColor) band.instanceColor.needsUpdate = true;
    }

    // Breaker grid on the panel's +z face (rows of switches; a few live amber).
    const brk = breakerRef.current;
    if (brk) {
      let i = 0;
      const cols = 4;
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = BOX.x + (c / (cols - 1) - 0.5) * PANEL_W * 0.66;
          const y = BOX.y + (r / (rows - 1) - 0.5) * PANEL_H * 0.74;
          _bo.position.set(x, y, BOX.z + PANEL_D / 2 + 0.08);
          _bo.quaternion.identity();
          _bo.scale.set(0.3 * PS, 0.34 * PS, 0.14);
          _bo.updateMatrix();
          brk.setMatrixAt(i, _bo.matrix);
          _sc.copy(BREAKER_LIVE[i] ? BRK_ON : BRK_OFF).multiplyScalar(1.4);
          brk.setColorAt(i, _sc);
          i++;
        }
      }
      brk.count = i;
      brk.instanceMatrix.needsUpdate = true;
      if (brk.instanceColor) brk.instanceColor.needsUpdate = true;
    }

    // Cavity faces — two long parallel drywall planes (thin boxes: solid from
    // both sides, readable edges at the mouth).
    const pl = planeRef.current;
    if (pl) {
      const h = WALL_Y1 - WALL_Y0;
      const len = WALL_Z0 - WALL_Z1;
      const cy = (WALL_Y0 + WALL_Y1) / 2;
      const cz = (WALL_Z0 + WALL_Z1) / 2;
      [WALL_X_NEG, WALL_X_POS].forEach((x, i) => {
        _bo.position.set(x, cy, cz);
        _bo.quaternion.identity();
        _bo.scale.set(0.14, h, len);
        _bo.updateMatrix();
        pl.setMatrixAt(i, _bo.matrix);
      });
      pl.instanceMatrix.needsUpdate = true;
    }

    // Timber lattice: vertical studs every ~4u hugging each face + staggered
    // noggin rows along z. Noggins sit at |Δy| ≥ 4.2 from the flight line.
    const lat = latticeRef.current;
    if (lat) {
      let li = 0;
      const beam = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        th: number,
      ) => {
        if (li >= MAX_LATTICE) return;
        _la.set(ax, ay, az);
        _lb.set(bx, by, bz);
        _lm.copy(_la).lerp(_lb, 0.5);
        _ld.copy(_lb).sub(_la).normalize();
        _lq.setFromUnitVectors(_X, _ld);
        _bo.position.copy(_lm);
        _bo.quaternion.copy(_lq);
        _bo.scale.set(_la.distanceTo(_lb), th, th);
        _bo.updateMatrix();
        lat.setMatrixAt(li++, _bo.matrix);
      };
      for (const sx of STUD_X) {
        let idx = 0;
        for (let z = WALL_Z0 - 2; z >= WALL_Z1 + 1; z -= STUD_STEP) {
          beam(sx, WALL_Y0, z, sx, WALL_Y1, z, 0.42);
          if (z - STUD_STEP >= WALL_Z1 + 1) {
            const stag = idx % 2 ? -0.55 : 0; // real noggins stagger for nailing
            beam(sx, A.y + 4.6 + stag, z, sx, A.y + 4.6 + stag, z - STUD_STEP, 0.34);
            beam(sx, A.y - 4.2 - stag, z, sx, A.y - 4.2 - stag, z - STUD_STEP, 0.34);
          }
          idx++;
        }
      }
      lat.count = li;
      lat.instanceMatrix.needsUpdate = true;
    }

    // Steel fittings: junction boxes where runs kink + staple clamps collaring
    // the free conduits near the -x stud row. Skipped within r<2 of the axis so
    // a fitting's own body can never intrude on the flight line.
    const fit = fittingsRef.current;
    if (fit) {
      let fi = 0;
      const put = () => {
        if (fi >= MAX_FITTINGS) return;
        _bo.updateMatrix();
        fit.setMatrixAt(fi++, _bo.matrix);
      };
      for (const p of FEED_STAGES) {
        if (rXY(p) < 2.0) continue;
        _bo.position.copy(p);
        _bo.quaternion.identity();
        _bo.scale.set(0.95, 0.95, 0.6);
        put();
      }
      for (let ci = 3; ci < 6; ci++) {
        for (const t of [0.3, 0.62]) {
          CONDUITS[ci].curve.getPointAt(t, _bp);
          if (rXY(_bp) < 2.0) continue;
          _bo.position.copy(_bp);
          _bo.quaternion.identity();
          _bo.scale.set(0.8, 0.8, 0.5);
          put();
        }
      }
      for (const td of CONDUITS) {
        if (td.feed) continue;
        for (let z = WALL_Z0 - 3; z >= WALL_Z1; z -= STUD_STEP * 2) {
          const t = Math.min(0.98, Math.max(0.02, (A.z + 30 - z) / 60));
          td.curve.getPointAt(t, _bp);
          if (Math.abs(_bp.x - STUD_X[0]) > 1.8 || rXY(_bp) < 2.0) continue;
          td.curve.getTangentAt(t, _bt);
          _lq.setFromUnitVectors(_X, _bt);
          const d = td.radius * 2 + 0.18;
          _bo.position.copy(_bp);
          _bo.quaternion.copy(_lq);
          _bo.scale.set(0.3, d, d);
          put();
        }
      }
      fit.count = fi;
      fit.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame((_, dt) => {
    // Traveling-pulse phase: base flow + scroll-velocity hurry (same soft-knee
    // normalization as the audio wind bus — Lenis velocity has no fixed unit).
    const v = Math.abs(useExperience.getState().velocity);
    COPPER_UNIFORMS.uPulseTime.value += dt * (0.5 + 1.9 * (1 - Math.exp(-v / 30)));

    // Arc sparks: higher strike rate (0.006 → 0.02) with a FASTER decay so each
    // strike reads as a brief crack of life, not a hanging glow.
    const m = sparkRef.current;
    if (m && m.instanceColor) {
      const b = bright.current;
      const decay = Math.max(0, 1 - dt * 14);
      for (let i = 0; i < b.length; i++) {
        b[i] *= decay;
        if (Math.random() < 0.02) b[i] = 1.6 + Math.random() * 1.6;
        _sc.copy(ARC).multiplyScalar(b[i]);
        m.setColorAt(i, _sc);
      }
      m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {CONDUIT_GEOMS.map((g, i) => (
        <mesh key={`c${i}`} geometry={g} material={CONDUIT_MAT} />
      ))}
      {COPPER_GEOMS.map((g, i) => (
        <mesh key={`w${i}`} geometry={g} material={COPPER_MAT} />
      ))}
      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        {/* pure-glow light source — the one legitimate toneMapped:false class */}
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Circuit-ID bands (desaturated, graded — printed insulation). */}
      <instancedMesh ref={bandRef} args={[undefined, undefined, BAND_CAP]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10, 1, true]} />
        <meshBasicMaterial />
      </instancedMesh>

      {/* Wall cavity context — faces + lattice + fittings (3 instanced draws).
          Silhouette-critical: this is what makes "inside the wall" READ, so it
          stays on every tier (static, instanced, no extra lights below). */}
      <instancedMesh ref={planeRef} args={[undefined, undefined, 2]} material={DRYWALL_MAT} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={latticeRef} args={[undefined, undefined, MAX_LATTICE]} material={TIMBER_MAT} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={fittingsRef} args={[undefined, undefined, MAX_FITTINGS]} material={STEEL_MAT} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      {/* Breaker / distribution panel — the maintained-system endpoint (hero). */}
      <mesh position={[BOX.x, BOX.y, BOX.z]} material={STEEL_MAT}>
        <boxGeometry args={[PANEL_W, PANEL_H, PANEL_D]} />
      </mesh>
      {/* Access door hinged on the +x edge, swung open FLAT against the +x wall
          face — fully clear of the flight line and of the drywall plane. */}
      <group
        position={[BOX.x + PANEL_W / 2, BOX.y, BOX.z + PANEL_D / 2]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <mesh position={[(PANEL_W - 0.5) / 2, 0, 0.07]} material={STEEL_MAT}>
          <boxGeometry args={[PANEL_W - 0.5, PANEL_H - 0.5, 0.1]} />
        </mesh>
      </group>
      <instancedMesh ref={breakerRef} args={[undefined, undefined, BREAKERS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        {/* breaker indicator LEDs — small pure-glow sources, allowed unmapped */}
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Warm key on the hero panel (power = amber per the palette; the old cool
          blue fought the dimension's service color). */}
      <pointLight position={[BOX.x, BOX.y + 1.2, BOX.z + 4]} color="#ffb35c" intensity={26} distance={24} decay={2} />
      {/* Cool rim (no shadow, all tiers) gives the dark conduits a lit/dark side
          so they read as round tubes, not flat silhouettes. Lateral to the dive. */}
      <pointLight position={[A.x - 3, A.y + 3, A.z + 6]} color="#9fc0ff" intensity={30} distance={30} decay={2} />
      {/* Dim COOL CAVITY FILL (all tiers — the wall context is silhouette-critical):
          rakes the drywall back + timber studs so "inside the wall" READS, instead
          of black around the tubes. Kept low + wide so it models the structure
          without lifting the night mood or out-shining the amber/copper conduits.
          Sits just inside the −x cavity face (x≈−2.5) and well clear of the flight
          line (axis x=1.5, r<1.2 → avoid x∈[0.3,2.7]). */}
      <pointLight position={[A.x - 4, A.y + 2, A.z]} color="#8aa6d8" intensity={24} distance={28} decay={2} />
      <pointLight position={[A.x - 4, A.y - 2, A.z - 16]} color="#7e9bce" intensity={20} distance={26} decay={2} />
      {/* Amber cavity fill — sells "lit by the copper's glow" on the timber and
          drywall (emissive doesn't actually light neighbors). Props tiers only;
          minimal keeps the geometry but drops this light. */}
      {tier.props && (
        <pointLight position={[A.x + 2, A.y + 3, A.z - 4]} color="#ff9a3c" intensity={18} distance={24} decay={2} />
      )}
    </group>
  );
}
