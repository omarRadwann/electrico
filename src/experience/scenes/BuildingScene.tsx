import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES, sampleCamera } from "../cameraPath";
import { useSurfaceMaps } from "../useSurfaceMaps";
import { asset } from "@/src/lib/asset";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";

/**
 * Dimension 2 — The Building (spec §7): approaching, architectural, grounded.
 * A tower the camera dives toward: a RIGID lit glass curtain wall over a solid
 * base, crowned by an EXPOSED STEEL skeleton (under construction — "we raise the
 * structures", and a deliberate foreshadow of THE FRAME next). A deeper cluster
 * of silhouette masses gives the skyline real depth instead of one facade in void.
 *
 * THE APERTURE (signature transition fix): the dive's flight line crosses the
 * facade plane at z≈-68.5 around (x≈-0.4, y≈+0.2) — verified below with
 * sampleCamera. Instead of slicing through a solid glass plane every loop (the
 * old P0 clip), the facade is BUILT WITH A DOOR: a window-sized gap is cleared in
 * the instanced window grid AND the glass, ringed by an emissive mullion frame,
 * and the glass is authored as two planes FLANKING the gap. The camera threads
 * the opening — "entering the building" becomes a beat, not an artifact.
 *
 * FACADE TRUTH (was a "drunken curtain wall"): window instances sit on a RIGID
 * grid (no positional jitter; variation lives only in brightness). An instanced
 * mullion grid (thin dark verticals/horizontals) + floor-slab lines give the
 * wall real tectonic order.
 *
 * GLASS PHYSICS: real transmission is FULL-tier only AND progress-gated (it
 * re-renders the opaque scene; only render it while the camera is in the Building
 * band p∈[0.13,0.47]). reduced/minimal get a cheap two-layer MeshPhysicalMaterial
 * WITHOUT transmission. No more transmission-doubled-with-opacity milkiness.
 */

const A = ZONES[1].position; // (-3, -1.5, -66)
const FACADE_Z = A.z - 3; // -69
const GLASS_Z = FACADE_Z + 0.5; // -68.5 — the plane the camera crosses
const FW = 22; // facade width
const FH = 34; // facade height
const COLS = 12;
const ROWS = 16;
const WIN = COLS * ROWS;
const FAR_WIN = 520; // distant lit windows scattered across the skyline masses
                     // (raised from 280: the right two-thirds of the framed
                     // composition read near-black + sparse — more lit windows on
                     // more masses fill it into a believable deep night skyline)
const WIN_COLOR = new THREE.Color("#ffc46b");
const COOL_WIN = new THREE.Color("#bcd2ff"); // ~15% of windows read cooler — real skylines aren't one colour

// --- THE APERTURE -----------------------------------------------------------
// Camera/facade crossing, recovered from sampleCamera (see the dev assert at the
// bottom): the flight line punches z=GLASS_Z at ≈(-0.4, +0.2). Generous half-
// extents clear the mouse-parallax lean (±0.25x, ±0.15y in the Rig) with margin,
// so the camera ALWAYS threads daylight, never a pane edge.
const APERTURE_X = -0.4;
const APERTURE_Y = 0.2;
const APERTURE_HW = 2.6; // half-width of the cleared doorway
const APERTURE_HH = 3.6; // half-height
// A window/mullion cell is cleared if its centre falls inside this rectangle.
function insideAperture(x: number, y: number): boolean {
  return Math.abs(x - APERTURE_X) < APERTURE_HW && Math.abs(y - APERTURE_Y) < APERTURE_HH;
}

// Solid tower body lives below the flight line; crown above it. Front face on the
// facade plane so the windows read as set into the building.
const BODY_Z = FACADE_Z - 9; // -78 (front face at -70, just behind the recessed windows — avoids z-fight)
const CROWN_Y0 = A.y + FH / 2 - 2; // ≈ +14.5, just under the facade top
const CROWN_Y1 = CROWN_Y0 + 15; // exposed steel rises above the lit floors
const CROWN_BEAMS = 24;

// Mullion grid: thin dark members between window columns/rows + floor-slab lines.
// One instanced draw. Capacity = verticals (COLS+1) + window-rows (ROWS+1) sized
// to FW×FH; we drop any member that crosses the aperture so the doorway is clean.
const MULLION_MAX = (COLS + 1) + (ROWS + 1) + 8;

// Background skyline masses — kept clear of the dive path and short of the Frame's
// z-region, so the camera never flies through one. CAMERA SAFETY: the corridor runs
// x∈[-3,+2.5], z∈[-52,-100] (descent → aperture → curve toward the Frame, verified
// with sampleCamera). Every mass below sits at |x−A.x|≥11 (front-right/front-left
// of the corridor) and z≥-94 (short of the Frame at z=-102), so none can clip.
// The right side is intentionally DENSER: the framed composition (camera at x=-3
// looking −Z) put empty black on screen-right (+x); these masses + their lit
// windows fill it so the skyline connects across the whole frame, not a facade on
// the left in a void.
const SKYLINE: [number, number, number, number, number, number][] = [
  // x, y, z, width, height, depth
  [A.x - 22, A.y - 10, A.z - 16, 16, 52, 16],
  [A.x + 18, A.y - 9, A.z - 14, 14, 48, 14],
  [A.x + 14, A.y - 13, A.z, 10, 36, 10],
  [A.x - 18, A.y - 12, A.z - 24, 14, 46, 14],
  [A.x + 16, A.y - 14, A.z - 24, 12, 42, 12],
  // --- added right-side fill (screen-right was empty black) ---
  [A.x + 25, A.y - 8, A.z - 8, 13, 50, 13], // tall right tower, near
  [A.x + 17, A.y - 16, A.z - 26, 11, 40, 11], // mid-right, set back (depth layer)
  [A.x + 22, A.y - 15, A.z - 18, 12, 44, 12], // right, mid-depth
  [A.x + 30, A.y - 13, A.z - 22, 10, 42, 10], // far-right edge filler
  [A.x + 19, A.y - 18, A.z - 6, 9, 34, 9], // short right foreground block
  // --- a couple more left/back masses so the backdrop has real depth ---
  [A.x - 14, A.y - 16, A.z - 40, 11, 38, 11], // deep left
  [A.x - 26, A.y - 14, A.z - 30, 12, 44, 12], // far left
];

// Crown / mullion beam layout temporaries (one scene, sequential).
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);

// Deterministic per-instance variation — a seeded LCG so the facade brightness
// pattern is STABLE across reloads (lets a future pass rhyme the match-cut, and
// keeps anything near the aperture from drifting into the doorway).
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Shared spotlight aim target (one Building scene → module singleton, allocated
// once; written only via the <primitive> position, never in render).
const KEY_TARGET = new THREE.Object3D();

export function BuildingScene() {
  const tier = TIERS[useExperience((s) => s.quality)];
  const winRef = useRef<THREE.InstancedMesh>(null);
  const farWinRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const mullionRef = useRef<THREE.InstancedMesh>(null);
  const crownMat = useRef<THREE.MeshStandardMaterial>(null);
  const apertureMat = useRef<THREE.MeshStandardMaterial>(null);
  const glassGroup = useRef<THREE.Group>(null);
  const keySpot = useRef<THREE.SpotLight>(null);
  const spotWarm = useRef(0);
  // Concrete relief on the solid masses so they catch light as real surfaces.
  const concrete = useSurfaceMaps(
    asset("/textures/concrete_nor_gl_1k.jpg"),
    asset("/textures/concrete_rough_1k.jpg"),
    3,
    4,
  );

  useLayoutEffect(() => {
    const w = winRef.current;
    if (w) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      const rng = makeRng(0x2b1d); // seeded — stable facade across reloads
      let i = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          // RIGID grid — variation belongs in brightness, not position (the old
          // ±0.4 jitter read as a drunken wall). Windows on the exact grid line.
          const x = A.x + (c / (COLS - 1) - 0.5) * FW;
          const y = A.y + (r / (ROWS - 1) - 0.5) * FH;
          // THE DOORWAY: skip windows inside the aperture so the camera threads a
          // clear opening, not a lit pane. Collapse to zero scale (instance stays
          // allocated; count is fixed) and force dark so no glow leaks through.
          const cleared = insideAperture(x, y);
          dummy.position.set(x, y, FACADE_Z - 0.25);
          if (cleared) dummy.scale.set(0, 0, 0);
          else dummy.scale.set(0.7, 0.95, 0.5);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          w.setMatrixAt(i, dummy.matrix);
          const cool = rng() < 0.28;
          const brightness = cleared ? 0 : rng() < 0.28 ? 0.0 : 0.7 + rng() * 1.4;
          color.copy(cool ? COOL_WIN : WIN_COLOR).multiplyScalar(brightness);
          w.setColorAt(i, color);
          i++;
        }
      }
      w.instanceMatrix.needsUpdate = true;
      if (w.instanceColor) w.instanceColor.needsUpdate = true;
    }

    // Mullion grid + floor-slab lines — the curtain wall's tectonic order. Thin
    // dark box members on the grid; any member crossing the aperture is dropped
    // so the doorway stays open (the emissive ring frames it instead).
    const mull = mullionRef.current;
    if (mull) {
      const dummy = new THREE.Object3D();
      let mi = 0;
      const member = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        th: number,
      ) => {
        if (mi >= MULLION_MAX) return;
        _a.set(ax, ay, az);
        _b.set(bx, by, bz);
        _mid.copy(_a).lerp(_b, 0.5);
        _dir.copy(_b).sub(_a).normalize();
        _q.setFromUnitVectors(_X, _dir);
        dummy.position.copy(_mid);
        dummy.quaternion.copy(_q);
        dummy.scale.set(_a.distanceTo(_b), th, th);
        dummy.updateMatrix();
        mull.setMatrixAt(mi++, dummy.matrix);
      };
      const x0 = A.x - FW / 2 - 0.6;
      const x1 = A.x + FW / 2 + 0.6;
      const y0 = A.y - FH / 2 - 0.6;
      const y1 = A.y + FH / 2 + 0.6;
      const mz = FACADE_Z + 0.15; // just proud of the windows
      // Vertical mullions between columns (drop any that cross the doorway in x).
      for (let c = 0; c <= COLS; c++) {
        const x = A.x + (c / COLS - 0.5) * (FW + 1.2);
        if (Math.abs(x - APERTURE_X) < APERTURE_HW) continue; // doorway gap
        member(x, y0, mz, x, y1, mz, 0.09);
      }
      // Horizontal floor-slab lines between rows (drop any crossing the doorway).
      for (let r = 0; r <= ROWS; r++) {
        const y = A.y + (r / ROWS - 0.5) * (FH + 1.2);
        if (Math.abs(y - APERTURE_Y) < APERTURE_HH) {
          // Split the slab line around the doorway (left + right segments).
          member(x0, y, mz, APERTURE_X - APERTURE_HW, y, mz, 0.11);
          member(APERTURE_X + APERTURE_HW, y, mz, x1, y, mz, 0.11);
        } else {
          member(x0, y, mz, x1, y, mz, 0.11);
        }
      }
      mull.count = mi;
      mull.instanceMatrix.needsUpdate = true;
    }

    // Exposed steel crown — an open girder cage on top of the tower.
    const crown = crownRef.current;
    if (crown) {
      const dummy = new THREE.Object3D();
      let i = 0;
      const setBeam = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        thick: number,
      ) => {
        if (i >= CROWN_BEAMS) return;
        _a.set(ax, ay, az);
        _b.set(bx, by, bz);
        _mid.copy(_a).lerp(_b, 0.5);
        _dir.copy(_b).sub(_a).normalize();
        _q.setFromUnitVectors(_X, _dir);
        dummy.position.copy(_mid);
        dummy.quaternion.copy(_q);
        dummy.scale.set(_a.distanceTo(_b), thick, thick);
        dummy.updateMatrix();
        crown.setMatrixAt(i++, dummy.matrix);
      };
      const sx = 9; // crown half-width
      const sz = 6; // crown half-depth
      const cx = [A.x - sx, A.x + sx, A.x + sx, A.x - sx];
      const cz = [BODY_Z - sz, BODY_Z - sz, BODY_Z + sz, BODY_Z + sz];
      // 4 corner columns
      for (let k = 0; k < 4; k++) setBeam(cx[k], CROWN_Y0, cz[k], cx[k], CROWN_Y1, cz[k], 0.2);
      // ring beams at base, mid, top
      for (const y of [CROWN_Y0, (CROWN_Y0 + CROWN_Y1) / 2, CROWN_Y1]) {
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          setBeam(cx[k], y, cz[k], cx[n], y, cz[n], 0.14);
        }
      }
      // one diagonal brace per face (lower half)
      const ymid = (CROWN_Y0 + CROWN_Y1) / 2;
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        setBeam(cx[k], CROWN_Y0, cz[k], cx[n], ymid, cz[n], 0.13);
      }
      crown.count = i;
      crown.instanceMatrix.needsUpdate = true;
    }

    // Distant lit windows scattered across the skyline masses — turns the dark
    // silhouettes into a living city backdrop with depth, filling the frame past
    // the main tower. Dimmer than the facade since they read as far away. Seeded
    // so the backdrop is stable across reloads.
    const far = farWinRef.current;
    if (far) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      const rng = makeRng(0x7f33);
      for (let n = 0; n < FAR_WIN; n++) {
        const [mx, my, mz, mw, mh, md] = SKYLINE[n % SKYLINE.length];
        const y = my + (rng() - 0.5) * mh * 0.9;
        const face = rng();
        let x: number;
        let z: number;
        if (face < 0.68) {
          // front (+z) face — what the approaching camera sees
          x = mx + (rng() - 0.5) * mw * 0.9;
          z = mz + md / 2 + 0.05;
          dummy.scale.set(0.5, 0.7, 0.1);
        } else {
          const sgn = face < 0.84 ? 1 : -1; // a side face
          x = mx + sgn * (mw / 2 + 0.05);
          z = mz + (rng() - 0.5) * md * 0.9;
          dummy.scale.set(0.1, 0.7, 0.5);
        }
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        far.setMatrixAt(n, dummy.matrix);
        // More windows lit (off-rate 0.32 → 0.2) and a touch brighter so the right
        // masses read as believable lit towers, not a few specks floating in void.
        const on = rng() < 0.2 ? 0.0 : 0.5 + rng() * 1.0;
        color.copy(rng() < 0.2 ? COOL_WIN : WIN_COLOR).multiplyScalar(on);
        far.setColorAt(n, color);
      }
      far.instanceMatrix.needsUpdate = true;
      if (far.instanceColor) far.instanceColor.needsUpdate = true;
    }
  }, []);

  useFrame((s) => {
    // Gentle steady glow — cooler/dimmer than THE FRAME so the Frame stays the
    // "blueprint" star, but enough to read as live exposed steel.
    if (crownMat.current) {
      crownMat.current.emissiveIntensity = 0.6 + 0.18 * Math.sin(s.clock.elapsedTime * 1.1);
    }
    // The aperture ring breathes warm — a beacon that says "thread here". Lit
    // Standard material → toneMapped:true; bloom recovered via emissiveIntensity.
    if (apertureMat.current) {
      apertureMat.current.emissiveIntensity = 1.6 + 0.5 * Math.sin(s.clock.elapsedTime * 1.6);
    }

    // PROGRESS-GATE the transmissive glass: it re-renders the whole opaque scene
    // every frame (a hidden always-on pass the project budget forbids). Only show
    // it inside the Building band — elsewhere it's pure waste 5 dimensions away.
    const g = glassGroup.current;
    if (g) {
      const p = useExperience.getState().progress;
      const want = p > 0.13 && p < 0.47;
      if (g.visible !== want) g.visible = want;
    }

    // PERF: freeze the static key-spot shadow map after a short warmup (full tier).
    const sp = keySpot.current;
    if (sp && tier.heavyProps) {
      if (spotWarm.current < 12) spotWarm.current += 1;
      else if (sp.shadow.autoUpdate) sp.shadow.autoUpdate = false;
    }
  });

  // Glass is authored as planes FLANKING the aperture (left / right / above /
  // below the doorway) so there is no pane on the flight line. Real transmission
  // (full tier) is heavy → swap to a cheap non-transmissive physical glass on
  // reduced/minimal (still reads as glass via IBL sheen + a hint of opacity).
  const realGlass = tier.heavyProps;
  const left = APERTURE_X - APERTURE_HW;
  const right = APERTURE_X + APERTURE_HW;
  const bottom = APERTURE_Y - APERTURE_HH;
  const top = APERTURE_Y + APERTURE_HH;
  const gW = FW + 3;
  const gH = FH + 4;
  const gx0 = A.x - gW / 2;
  const gx1 = A.x + gW / 2;
  const gy0 = A.y - gH / 2;
  const gy1 = A.y + gH / 2;
  // Four flanking rectangles (centre + half-size) that tile the facade minus the
  // doorway hole. Sized from the glass bounds so they never overlap the opening.
  const glassPanes: [number, number, number, number][] = [
    // left of door (full height)
    [(gx0 + left) / 2, A.y, left - gx0, gH],
    // right of door (full height)
    [(right + gx1) / 2, A.y, gx1 - right, gH],
    // above door (between the two verticals)
    [(left + right) / 2, (top + gy1) / 2, right - left, gy1 - top],
    // below door
    [(left + right) / 2, (gy0 + bottom) / 2, right - left, bottom - gy0],
  ];

  return (
    <group>
      {/* Background skyline — masses giving the city real depth. Albedo lifted off
          near-black (#0a0e16 → #131a26) + a faint warm emissive floor so each mass
          reads as a lit night TOWER its windows sit ON, instead of windows floating
          in void. Stays toneMapped (lit PBR) — the emissive floor is well under the
          0.55 bloom threshold, so it warms the silhouette without glowing. */}
      {SKYLINE.map(([x, y, z, w, h, d], idx) => (
        <mesh key={idx} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color="#131a26"
            emissive="#241a12"
            emissiveIntensity={0.6}
            roughness={0.72}
            metalness={0.22}
            normalMap={concrete.normalMap}
            roughnessMap={concrete.roughnessMap}
          />
        </mesh>
      ))}

      {/* Distant city windows on the skyline masses — depth + life in the backdrop. */}
      <instancedMesh ref={farWinRef} args={[undefined, undefined, FAR_WIN]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Tower mass — the lower floors the lit facade is set into. CAMERA SAFETY:
          after threading the doorway the camera flies INTO the building (z −70…−88
          at x≈0…3, y≈0…2 — verified with sampleCamera). A single solid box would
          swallow the camera, so the mass is HOLLOW along the flight corridor: a
          base slab BELOW the path, two side masses FLANKING it, and a back wall
          BEHIND the deepest the camera reaches — same "solid building" silhouette,
          but the camera passes through the lit atrium it just entered. */}
      {/* Base slab — floor of the lobby, below the flight line (top at y=-3). */}
      <mesh position={[A.x, A.y - 11, BODY_Z]} receiveShadow>
        <boxGeometry args={[26, 18, 16]} />
        <meshStandardMaterial color="#1a2735" roughness={0.7} metalness={0.28} normalMap={concrete.normalMap} roughnessMap={concrete.roughnessMap} />
      </mesh>
      {/* Left flank mass (x ≤ -5, clear of the corridor x∈[-2,4.5]). */}
      <mesh position={[A.x - 10.5, A.y + 2, BODY_Z]} castShadow receiveShadow>
        <boxGeometry args={[11, 34, 16]} />
        <meshStandardMaterial color="#20303f" roughness={0.7} metalness={0.28} normalMap={concrete.normalMap} roughnessMap={concrete.roughnessMap} />
      </mesh>
      {/* Right flank mass (x ≥ 4, clear of the corridor). Narrower — the corridor
          leans frame-right as the camera curves out toward the Frame. */}
      <mesh position={[A.x + 11, A.y + 2, BODY_Z]} castShadow receiveShadow>
        <boxGeometry args={[8, 34, 16]} />
        <meshStandardMaterial color="#20303f" roughness={0.7} metalness={0.28} normalMap={concrete.normalMap} roughnessMap={concrete.roughnessMap} />
      </mesh>
      {/* Inner side walls of the flanks (catch the warm doorway glow so the atrium
          reads as a lit interior, not two free-floating slabs). Thin, set inboard
          of the flanks, BELOW+beside the corridor — never on the flight line. */}
      <mesh position={[A.x - 6.5, A.y - 4, BODY_Z]} receiveShadow>
        <boxGeometry args={[0.4, 18, 16]} />
        <meshStandardMaterial color="#1c2836" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* No back wall: the camera flies OUT the rear of the atrium toward the Frame
          (it reaches z≈-90 at x≈3, then curves away). A rear pane would clip it. */}

      {/* Lit facade the camera dives toward — RIGID grid, doorway cleared. */}
      <instancedMesh ref={winRef} args={[undefined, undefined, WIN]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Mullion grid + floor-slab lines — the curtain wall's structural order. */}
      <instancedMesh ref={mullionRef} args={[undefined, undefined, MULLION_MAX]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#14181f" roughness={0.5} metalness={0.7} />
      </instancedMesh>

      {/* Glass curtain — planes FLANKING the doorway (no pane on the flight line),
          progress-gated so the transmission pass only runs in the Building band.
          Starts hidden so the (heavy) transmission RT never renders at boot in the
          City; useFrame turns it on the moment the camera enters the band. */}
      <group ref={glassGroup} visible={false}>
        {glassPanes.map(([cx, cy, w, h], idx) =>
          w > 0.05 && h > 0.05 ? (
            <mesh key={idx} position={[cx, cy, GLASS_Z]}>
              <planeGeometry args={[w, h]} />
              {realGlass ? (
                // FULL: real transmission, no opacity-doubling (the old milky bug).
                <meshPhysicalMaterial
                  transmission={0.9}
                  roughness={0.06}
                  thickness={0.2}
                  ior={1.45}
                  metalness={0}
                  color="#c8d4e6"
                />
              ) : (
                // REDUCED/MINIMAL: cheap glass — IBL sheen + faint tint, NO
                // transmission render target. Still reads as glass, costs nothing.
                <meshPhysicalMaterial
                  roughness={0.1}
                  metalness={0}
                  color="#9fb2cc"
                  transparent
                  opacity={0.22}
                />
              )}
            </mesh>
          ) : null,
        )}
        {/* Emissive MULLION FRAME RING around the doorway — the diegetic "enter
            here" portal lip. Lit Standard material (toneMapped:true); bloom via
            emissiveIntensity. Four box members hugging the aperture edges. */}
        <group>
          {(
            [
              // [cx, cy, w, h] of each frame bar (thin), just outside the opening
              [APERTURE_X, top + 0.18, APERTURE_HW * 2 + 0.7, 0.36],
              [APERTURE_X, bottom - 0.18, APERTURE_HW * 2 + 0.7, 0.36],
              [left - 0.18, APERTURE_Y, 0.36, APERTURE_HH * 2 + 0.7],
              [right + 0.18, APERTURE_Y, 0.36, APERTURE_HH * 2 + 0.7],
            ] as [number, number, number, number][]
          ).map(([cx, cy, w, h], idx) => (
            <mesh key={idx} position={[cx, cy, GLASS_Z + 0.1]}>
              <boxGeometry args={[w, h, 0.3]} />
              <meshStandardMaterial
                ref={idx === 0 ? apertureMat : undefined}
                color="#3a2a14"
                emissive="#ffb347"
                emissiveIntensity={1.6}
                roughness={0.4}
                metalness={0.6}
                toneMapped
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* Exposed steel crown — the structure being raised; foreshadows THE FRAME.
          toneMapped:true (lit PBR steel) — bloom recovered via emissiveIntensity. */}
      <instancedMesh ref={crownRef} args={[undefined, undefined, CROWN_BEAMS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          ref={crownMat}
          color="#5c6b86"
          emissive="#4d74c8"
          emissiveIntensity={0.6}
          toneMapped
          roughness={0.35}
          metalness={0.9}
        />
      </instancedMesh>

      {/* Raking warm KEY (casts on full) models the tower mass; cool back-rim peels
          the silhouette off the night; two warm spill points bleed light onto the
          body between the windows so the facade reads as a lit wall, not cards.
          All lateral/above the x=-3 dive line and IN FRONT of the facade. */}
      <primitive object={KEY_TARGET} position={[A.x, A.y, FACADE_Z]} />
      <spotLight
        ref={keySpot}
        position={[A.x - 16, A.y + 20, FACADE_Z + 10]}
        target={KEY_TARGET}
        color="#ffd9a0"
        intensity={2400}
        distance={120}
        decay={2}
        angle={0.62}
        penumbra={0.8}
        castShadow={tier.heavyProps}
        shadow-mapSize={[tier.shadowMapSize, tier.shadowMapSize]}
        shadow-bias={-0.0005}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      <pointLight position={[A.x + 16, A.y + 6, FACADE_Z + 8]} color="#6f86c8" intensity={120} distance={70} decay={2} />
      {/* Broad cool skyline fill raking the RIGHT-side masses so they read as lit
          night towers connected to their windows, not flat black silhouettes. Wide
          distance, no shadow, well clear of the dive corridor (x≈+20). */}
      <pointLight position={[A.x + 20, A.y + 10, A.z + 6]} color="#5a73aa" intensity={140} distance={90} decay={2} />
      <pointLight position={[A.x - 6, A.y + 5, FACADE_Z + 3]} color="#ffc46b" intensity={70} distance={26} decay={2} />
      <pointLight position={[A.x + 7, A.y - 7, FACADE_Z + 3]} color="#ffc46b" intensity={70} distance={26} decay={2} />
      {/* A warm glow lamp INSIDE the doorway so the threaded opening reads as a lit
          threshold the camera flies into (the "entering the building" beat). */}
      <pointLight position={[APERTURE_X, APERTURE_Y, GLASS_Z - 2]} color="#ffcf8f" intensity={26} distance={12} decay={2} />
    </group>
  );
}

// Dev-only: assert the aperture actually sits on the flight line at the facade
// crossing. If the authored camera path is retuned, this prints the new crossing
// so the doorway can be re-centred (camera-safety is verified, not assumed).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const _p = new THREE.Vector3();
  const _l = new THREE.Vector3();
  let prevZ = Infinity;
  let prevX = 0;
  let prevY = 0;
  let prevP = 0;
  for (let p = 0.22; p <= 0.47; p += 0.002) {
    sampleCamera(p, _p, _l);
    if (prevZ > GLASS_Z && _p.z <= GLASS_Z) {
      // linear interp to the exact z-crossing for the (x,y) hit point
      const t = (GLASS_Z - prevZ) / (_p.z - prevZ);
      const cx = prevX + (_p.x - prevX) * t;
      const cy = prevY + (_p.y - prevY) * t;
      if (
        Math.abs(cx - APERTURE_X) > APERTURE_HW - 0.7 ||
        Math.abs(cy - APERTURE_Y) > APERTURE_HH - 0.7
      ) {
        console.warn(
          `[BuildingScene] aperture may not cover the facade crossing — ` +
            `cam crosses z=${GLASS_Z} near p≈${(prevP + (p - prevP) * t).toFixed(3)} ` +
            `at (${cx.toFixed(2)}, ${cy.toFixed(2)}) ` +
            `(aperture ${APERTURE_X}±${APERTURE_HW}, ${APERTURE_Y}±${APERTURE_HH}). Re-centre.`,
        );
      }
      break;
    }
    prevZ = _p.z;
    prevX = _p.x;
    prevY = _p.y;
    prevP = p;
  }
}
