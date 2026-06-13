import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";

/**
 * Dimension 1 — The City at Night (spec §7). The opening "powering on" vista the
 * camera descends into. Dark instanced towers (1 draw call) studded with ~1800
 * instanced emissive window lights (1 draw call) that bloom into a living grid.
 * Its one verb is FLICKER: windows ease on/off (no instant pops) so the city
 * breathes — the QUALITY BAR every other dimension must reach.
 *
 * Procedural, texture-free — the cinematic look is built from glow, not photos.
 *
 * PERF (City is the most-rendered dimension — it's on screen at boot and again
 * every loop seam): the flicker instanceColor upload is SKIPPED when the camera
 * has left the City band (progress > CITY_BAND_END). The old code uploaded all
 * 1800 instances every frame for the entire session, even 6 dimensions away.
 *
 * DETERMINISM: the window/tower layout is SEEDED (not bare Math.random) so it's
 * stable across reloads — a future pass can rhyme the Current→City match-cut by
 * sampling these same world positions, and nothing drifts onto the flight line.
 */

const CITY = ZONES[0].position; // dimension-1 anchor
const GROUND_Y = -7;
const COLS = 7;
const ROWS = 7;
const TOWERS = COLS * ROWS;
const WINDOWS = 1800;
const SPACING = 8;
const WIN_COLOR = new THREE.Color("#ffb24d"); // warm amber window light
const GREEBLE_COUNT = 200; // rooftop detail instances (caps / masts / units)

// Past this progress the camera has left the City for the Building — stop the
// per-frame flicker upload entirely (the City window colors are then static).
const CITY_BAND_END = 0.25;
// Past this, swap the (heavy) wet-street reflector for a plain dark floor: the
// reflection RT renders the scene from the floor's POV every frame, wasted once
// the camera is diving away. Gate sits ON TOP of the tier reflectorRes gate.
const REFLECTOR_BAND_END = 0.3;

// Traffic streaks (CityLife) ride lanes at SPACING intervals; clamp tower
// half-widths so a wide tower corner never pokes into a streak lane (the old
// w/d up to 5 → half-width 2.5 could clip the ±1.5-jittered lanes). Cap at 2.0.
const TOWER_MAX_HALF = 2.0;

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

// Seeded LCG — deterministic layout (see header). One generator per layout pass.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- FLICKER FADE POOL ------------------------------------------------------
// ~8 windows ease toward a new brightness target over 0.3–1.5s, instead of
// instant hard pops. Each slot tracks the instance, its current + target
// brightness, and the elapsed/duration. When a fade completes a new window is
// picked. Module-scope (one City scene) — no per-frame allocation.
const FADE_SLOTS = 8;
interface Fade {
  wi: number; // window instance index
  from: number; // brightness at fade start
  to: number; // brightness target
  t: number; // elapsed
  dur: number; // duration
}

export function CityScene() {
  const towersRef = useRef<THREE.InstancedMesh>(null);
  const windowsRef = useRef<THREE.InstancedMesh>(null);
  const greeblesRef = useRef<THREE.InstancedMesh>(null);
  const reflectorMesh = useRef<THREE.Mesh>(null);
  const plainFloor = useRef<THREE.Mesh>(null);
  // The wet-street reflection is the heaviest single cost in the City — the first
  // quality-tier toggle (res 96 → 0 = a plain dark floor on reduced/minimal).
  const reflectorRes = TIERS[useExperience((s) => s.quality)].reflectorRes;

  // Per-instance baseline brightness (the "rest" value each window fades back
  // toward) so a fade lands on a believable level, not a global random.
  const baseBright = useRef<Float32Array>(new Float32Array(WINDOWS));
  // Per-instance normalized x (0..1 across the grid) — drives the power-on
  // cascade so the city lights up column-by-column.
  const winNormX = useRef<Float32Array>(new Float32Array(WINDOWS));
  const fades = useRef<Fade[]>([]);

  // POWER-ON CASCADE state: when the loader completes (loadProgress→1), a ~2s
  // wave sweeps the city ON column-by-column ("loading completion switches the
  // city on" — the loader finale). Runs once; the flicker resumes after.
  const cascadeT = useRef(-1); // <0 = not running; ≥0 = elapsed seconds
  const cascadeDone = useRef(false);
  const loadComplete = useExperience((s) => s.loadProgress >= 1);

  useLayoutEffect(() => {
    const towers = towersRef.current;
    const windows = windowsRef.current;
    if (!towers || !windows) return;

    const rng = makeRng(0x0c17); // seeded — stable city across reloads
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const placed: Tower[] = [];
    // x-extent of the grid, for the cascade's normalized-x (computed up front so
    // the window loop can store each instance's 0..1 column position).
    const halfSpan = (COLS / 2) * SPACING + 3;
    const xMin = CITY.x - halfSpan;
    const xSpan = halfSpan * 2;

    // Towers on a (seeded) jittered grid centred on the dimension-1 anchor. Tower
    // half-widths clamped so corners never clip the traffic streak lanes.
    let ti = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c - COLS / 2) * SPACING + (rng() - 0.5) * 3 + CITY.x;
        const z = (r - ROWS / 2) * SPACING + (rng() - 0.5) * 3 + CITY.z;
        const w = Math.min(2.5 + rng() * 2.5, TOWER_MAX_HALF * 2);
        const d = Math.min(2.5 + rng() * 2.5, TOWER_MAX_HALF * 2);
        const h = 5 + rng() * 17;
        dummy.position.set(x, GROUND_Y + h / 2, z);
        dummy.scale.set(w, h, d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        towers.setMatrixAt(ti, dummy.matrix);
        placed.push({ x, z, w, d, h });
        ti++;
      }
    }
    towers.instanceMatrix.needsUpdate = true;

    // Window lights scattered on the tower faces. Some windows stay dark for
    // realistic variety; brightness varies per instance via instanceColor.
    dummy.rotation.set(0, 0, 0);
    const base = baseBright.current;
    for (let wi = 0; wi < WINDOWS; wi++) {
      const t = placed[wi % placed.length];
      const yy = GROUND_Y + 1 + rng() * (t.h - 1.5);
      const onX = rng() < 0.5;
      const sign = rng() < 0.5 ? 1 : -1;
      const ww = 0.18 + rng() * 0.14; // window width
      const wh = 0.3 + rng() * 0.26; // window height (taller than wide)
      let x: number;
      let z: number;
      // Flush with the facade (not proud) + thin along the face normal, so each
      // window reads as set *into* the tower, framed by the dark wall edge.
      if (onX) {
        x = t.x + sign * (t.w / 2);
        z = t.z + (rng() - 0.5) * t.d * 0.85;
        dummy.scale.set(0.06, wh, ww);
      } else {
        z = t.z + sign * (t.d / 2);
        x = t.x + (rng() - 0.5) * t.w * 0.85;
        dummy.scale.set(ww, wh, 0.06);
      }
      dummy.position.set(x, yy, z);
      dummy.updateMatrix();
      windows.setMatrixAt(wi, dummy.matrix);

      const brightness = rng() < 0.18 ? 0.0 : 0.5 + rng() * 1.4;
      base[wi] = brightness;
      winNormX.current[wi] = THREE.MathUtils.clamp((x - xMin) / xSpan, 0, 1);
      color.copy(WIN_COLOR).multiplyScalar(brightness);
      windows.setColorAt(wi, color);
    }
    windows.instanceMatrix.needsUpdate = true;
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;

    // Seed the fade pool — each slot starts mid-life on a random window so the
    // flicker is staggered, not synchronized.
    const arr: Fade[] = [];
    for (let i = 0; i < FADE_SLOTS; i++) {
      const wi = Math.floor(rng() * WINDOWS);
      arr.push({ wi, from: base[wi], to: base[wi], t: 0, dur: 0.3 + rng() * 1.2 });
    }
    fades.current = arr;

    // Rooftop greebles — setback caps, antenna masts, roof units — so the skyline
    // silhouette reads as buildings, not uniform flat-topped boxes.
    const greebles = greeblesRef.current;
    let gi = 0;
    if (greebles) {
      for (const t of placed) {
        const roofY = GROUND_Y + t.h;
        if (rng() < 0.55 && gi < GREEBLE_COUNT) {
          const capH = 1.5 + rng() * 3;
          dummy.position.set(t.x + (rng() - 0.5) * t.w * 0.3, roofY + capH / 2, t.z + (rng() - 0.5) * t.d * 0.3);
          dummy.scale.set(t.w * (0.4 + rng() * 0.3), capH, t.d * (0.4 + rng() * 0.3));
          dummy.updateMatrix();
          greebles.setMatrixAt(gi++, dummy.matrix);
        }
        if (rng() < 0.35 && gi < GREEBLE_COUNT) {
          const mastH = 2 + rng() * 5;
          dummy.position.set(t.x + (rng() - 0.5) * t.w * 0.4, roofY + mastH / 2, t.z + (rng() - 0.5) * t.d * 0.4);
          dummy.scale.set(0.16, mastH, 0.16);
          dummy.updateMatrix();
          greebles.setMatrixAt(gi++, dummy.matrix);
        }
        const units = 1 + Math.floor(rng() * 2);
        for (let u = 0; u < units && gi < GREEBLE_COUNT; u++) {
          const uh = 0.4 + rng() * 0.8;
          dummy.position.set(t.x + (rng() - 0.5) * t.w * 0.7, roofY + uh / 2, t.z + (rng() - 0.5) * t.d * 0.7);
          dummy.scale.set(0.5 + rng() * 0.7, uh, 0.5 + rng() * 0.7);
          dummy.updateMatrix();
          greebles.setMatrixAt(gi++, dummy.matrix);
        }
      }
      greebles.count = gi;
      greebles.instanceMatrix.needsUpdate = true;
    }
  }, []);

  // POWER-ON CASCADE trigger — arm the wave the first time loading completes.
  // (loadComplete is low-frequency; this effect runs on the rising edge only.)
  useLayoutEffect(() => {
    if (loadComplete && !cascadeDone.current && cascadeT.current < 0) {
      cascadeT.current = 0; // start the sweep
    }
  }, [loadComplete]);

  // FLICKER: eased fades (no instant pops). Each slot lerps a window's brightness
  // toward its target; on completion it retargets to a new window. PERF: the
  // whole upload is skipped once the camera leaves the City band, and the
  // reflector RT is gated to the band too.
  const color = useRef(new THREE.Color());
  const rng = useRef(makeRng(0x9e3a));
  const CASCADE_DUR = 2.0; // seconds for the wave to cross the whole city
  const CASCADE_EDGE = 0.18; // soft front width in normalized-x
  useFrame((_s, dt) => {
    const p = useExperience.getState().progress;

    // POWER-ON CASCADE: a front sweeps left→right in normalized-x; each window
    // ramps from dark to its baseline as the front passes it. Drives the whole
    // 1800-instance buffer for ~2s, then hands back to the flicker pool. Runs at
    // boot when the camera is in the City band, so the upload cost is in-budget.
    const windowsC = windowsRef.current;
    if (cascadeT.current >= 0 && windowsC && windowsC.instanceColor) {
      cascadeT.current += dt;
      const front = (cascadeT.current / CASCADE_DUR) * (1 + CASCADE_EDGE);
      const base = baseBright.current;
      const nx = winNormX.current;
      for (let wi = 0; wi < WINDOWS; wi++) {
        // 0 before the front reaches the window, 1 after it has fully passed.
        const k = THREE.MathUtils.clamp((front - nx[wi]) / CASCADE_EDGE, 0, 1);
        const e = k * k * (3 - 2 * k); // smoothstep on the ramp
        color.current.copy(WIN_COLOR).multiplyScalar(base[wi] * e);
        windowsC.setColorAt(wi, color.current);
      }
      windowsC.instanceColor.needsUpdate = true;
      if (cascadeT.current >= CASCADE_DUR + 0.2) {
        cascadeT.current = -1;
        cascadeDone.current = true;
      }
      return; // cascade owns the buffer this frame
    }

    // Reflector ↔ plain-floor swap on top of the tier gate. Setting the reflector
    // mesh invisible stops its reflection RT (MeshReflectorMaterial updates only
    // when the mesh is actually rendered); the plain floor takes over the look.
    const rm = reflectorMesh.current;
    const pf = plainFloor.current;
    if (rm && pf) {
      const wantReflector = reflectorRes > 0 && p <= REFLECTOR_BAND_END;
      if (rm.visible !== wantReflector) rm.visible = wantReflector;
      if (pf.visible !== !wantReflector) pf.visible = !wantReflector;
    }

    // Outside the City band: freeze the flicker (no upload, no work). The window
    // colors hold at their last values — invisible from a dimension away anyway.
    if (p > CITY_BAND_END) return;

    const windows = windowsRef.current;
    if (!windows || !windows.instanceColor) return;
    const base = baseBright.current;
    const arr = fades.current;
    const g = rng.current;
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      f.t += dt;
      const k = Math.min(f.t / f.dur, 1);
      // smootherstep ease so the on/off reads as a soft swell, not a ramp.
      const e = k * k * k * (k * (k * 6 - 15) + 10);
      const b = f.from + (f.to - f.from) * e;
      color.current.copy(WIN_COLOR).multiplyScalar(b);
      windows.setColorAt(f.wi, color.current);
      if (k >= 1) {
        // Retarget: pick a new window, fade it to either near-off or a lit level.
        const nwi = Math.floor(g() * WINDOWS);
        f.wi = nwi;
        f.from = base[nwi];
        f.to = g() < 0.3 ? 0.05 : 0.5 + g() * 1.5;
        base[nwi] = f.to; // remember the new rest level
        f.t = 0;
        f.dur = 0.3 + g() * 1.2;
      }
    }
    windows.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Wet-street reflective ground — window lights + tower silhouettes reflect
          in it. Progress-gated: invisible (RT off) once the camera dives away,
          where the plain dark floor below takes over. */}
      <mesh ref={reflectorMesh} rotation={[-Math.PI / 2, 0, 0]} position={[CITY.x, GROUND_Y, CITY.z]} visible={reflectorRes > 0}>
        <planeGeometry args={[260, 260]} />
        {reflectorRes > 0 ? (
          <MeshReflectorMaterial
            key={reflectorRes} /* resolution is constructor-time — remount to change it */
            resolution={reflectorRes}
            mirror={0}
            blur={[300, 300]}
            mixBlur={2.5}
            mixStrength={0.55}
            roughness={0.85}
            depthScale={0}
            color="#070912"
            metalness={0.25}
          />
        ) : (
          <meshStandardMaterial color="#070912" roughness={0.85} metalness={0.25} />
        )}
      </mesh>
      {/* Plain dark floor — always present beneath; revealed when the reflector is
          gated off (or when the tier has no reflector at all). */}
      <mesh
        ref={plainFloor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[CITY.x, GROUND_Y - 0.02, CITY.z]}
        visible={reflectorRes === 0}
      >
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#070912" roughness={0.85} metalness={0.25} />
      </mesh>

      {/* Dark tower masses. */}
      <instancedMesh
        ref={towersRef}
        args={[undefined, undefined, TOWERS]}
        castShadow={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b101c" roughness={0.85} metalness={0.15} />
      </instancedMesh>

      {/* Rooftop greebles — break the flat-top boxes into a real skyline. */}
      <instancedMesh ref={greeblesRef} args={[undefined, undefined, GREEBLE_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0c1220" roughness={0.8} metalness={0.2} />
      </instancedMesh>

      {/* Emissive window lights — unlit basic material so they read as pure glow
          for the bloom pass; instanceColor carries per-window brightness. */}
      <instancedMesh
        ref={windowsRef}
        args={[undefined, undefined, WINDOWS]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
