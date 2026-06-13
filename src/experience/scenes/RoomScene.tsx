import { useFrame } from "@react-three/fiber";
import { useGLTF, useProgress } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES, sampleCamera } from "../cameraPath";
import { asset } from "@/src/lib/asset";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";

/**
 * Dimension 4 — The Smart Living Room (spec §7): warm, human, intelligent.
 *
 * SCALE FIX (was a 46×56 floor + 28-high walls = a warehouse, photoreal furniture
 * floating in a void): a real DOMESTIC SHELL now — an 18-wide × ~26-deep floor
 * (deep enough to span the camera's descent-in to fly-out), ~9.5-high walls, a
 * CEILING with ONE recessed warm downlight cone over the furniture cluster, and a
 * BACK-WALL WINDOW glowing with the night city (ties dim4 back to dim1).
 *
 * CAMERA SAFETY (verified with sampleCamera, see the dev assert at file end):
 *  - The FRONT is OPEN (the dollhouse "fourth wall"): the camera descends IN over
 *    the front threshold around z≈-127 at y≈2.5 — a solid front wall would clip it.
 *  - The camera EXITS through the BACK wall (z=-152) at ≈(x=1.1, y=1.6). That
 *    crossing is authored as a DOORWAY the camera threads — an "leaving the room"
 *    beat — with an emissive jamb. The night-city window sits to the LEFT of the
 *    doorway so the two features read distinctly.
 *
 * Verb: THINK — the teal smart devices pulse like a calm heartbeat; a column-scan
 * sweeps the wall panel ("the home thinking"). Shadows: the standing lamp casts a
 * real contact shadow (full tier only, frozen after load — see the lamp light).
 */

const A = ZONES[3].position; // (-2, -2, -138)
const FLOOR_Y = A.y - 3; // -5

// --- DOMESTIC SHELL dimensions ---------------------------------------------
const ROOM_CX = A.x; // -2
const ROOM_W = 18; // floor width (x)
const FRONT_Z = A.z + 11; // -127 — open front threshold the camera enters over
const BACK_Z = A.z - 14; // -152 — back wall the camera exits through (doorway)
const ROOM_CZ = (FRONT_Z + BACK_Z) / 2; // -139.5
const ROOM_D = FRONT_Z - BACK_Z; // 25 deep
const WALL_H = 9.5;
const CEIL_Y = FLOOR_Y + WALL_H; // +4.5
const X_LEFT = ROOM_CX - ROOM_W / 2; // -11
const X_RIGHT = ROOM_CX + ROOM_W / 2; // +7

// THE DOORWAY in the back wall — centred on the camera's exit crossing so the
// camera threads a real opening, never a solid pane.
const DOOR_X = 1.1;
const DOOR_Y = FLOOR_Y + 3.6; // sill on the floor (FLOOR_Y), head at +2.2
const DOOR_HW = 1.9;
const DOOR_HH = 3.6; // y∈[-5, +2.2] — covers the y≈1.6 exit + mouse parallax (±0.15)

// Night-city WINDOW on the far-left of the back wall (glows with the dim-1 city
// beyond — ties the Room to the City). The smart panel sits between it and the
// doorway; they share the "left of door" wall segment (x∈[-11,-0.8]) without
// overlap: window x∈[-10.5,-4.5], panel x∈[-4.0,-1.2], door opening x∈[-0.8,3.0].
const WIN_CX = X_LEFT + 3.5; // -7.5
const WIN_CY = FLOOR_Y + 5.2;
const WIN_W = 6;
const WIN_H = 4.4;

// Smart wall panel + its UI button grid sit between the window and the doorway.
const PANEL_CX = -2.6;
const PANEL_CY = FLOOR_Y + 5.2;

const WOOD = new THREE.MeshStandardMaterial({ color: "#241a12", roughness: 0.85, metalness: 0.08 });
const WALL = new THREE.MeshStandardMaterial({ color: "#2a201a", roughness: 0.92, metalness: 0.04 });
const CEIL = new THREE.MeshStandardMaterial({ color: "#241c16", roughness: 0.95, metalness: 0.03 });
const RUG = new THREE.MeshStandardMaterial({ color: "#2e2016", roughness: 0.97, metalness: 0.02 });
const SHELF = new THREE.MeshStandardMaterial({ color: "#1d1510", roughness: 0.8, metalness: 0.06 });
// LAMP / DEVICE / hub are LIT standard materials → toneMapped:true (the #1
// "cheap neon" fix). Bloom is recovered via emissiveIntensity (bloom reads
// pre-tonemap HDR at threshold 0.55), not by skipping the filmic grade.
const LAMP = new THREE.MeshStandardMaterial({
  color: "#3a2c18", emissive: "#ffcf95", emissiveIntensity: 2.6, toneMapped: true,
});
const DEVICE = new THREE.MeshStandardMaterial({
  color: "#08302f", emissive: "#43d0c4", emissiveIntensity: 2.2, toneMapped: true, roughness: 0.4,
});
const DOOR_JAMB = new THREE.MeshStandardMaterial({
  color: "#2a1c10", emissive: "#ffb347", emissiveIntensity: 1.4, toneMapped: true, roughness: 0.5, metalness: 0.5,
});

// The night city seen through the back-wall window — pure emissive panel (a real
// light source) so it bloom-glows; toneMapped:false is correct for a glow card.
const CITY_GLOW = new THREE.MeshBasicMaterial({ color: "#1a3050", toneMapped: false });

// Smart control-panel UI — an animated grid of "buttons" on the wall screen.
const UI_TEAL = new THREE.Color("#43d0c4");
const _uiCol = new THREE.Color();
const UI_COLS = 5;
const UI_ROWS = 3;
const UI_COUNT = UI_COLS * UI_ROWS;

// Bookshelf books — one instanced mesh of randomized thin book boxes on 5 shelves.
const BOOK_COUNT = 64;
const BOOK_HUES = [
  new THREE.Color("#6a3a28"), new THREE.Color("#27384a"), new THREE.Color("#4a3320"),
  new THREE.Color("#3a4a3a"), new THREE.Color("#5a2a2a"), new THREE.Color("#2a3a4a"),
];

// Lamp sits ON the framed furniture cluster (the camera's Room arrival key looks
// at ≈(-3,-3.5,-138)) so its glow + cast shadow land on the sofa/table.
const LAMP_X = A.x + 3;
const LAMP_Z = A.z;

// Wall-mounted bookshelf (against the right wall, in frame from the 3/4 view).
const SHELF_X = X_RIGHT - 0.5; // ≈ +6.5
const SHELF_Z = A.z;
const SHELF_Y0 = FLOOR_Y + 0.6;
const SHELF_H = 6.4;
const SHELF_LEVELS = 5;
const SHELF_W = 3.4; // along z

// Model URLs — the asset lane delivered Draco+webp GLBs; switch to them and
// enable Draco via useGLTF(url, true) (the integrator hosts the decoder
// centrally). asset() prefixes the GH Pages basePath (raw loader URLs aren't
// auto-prefixed by Next, so they'd 404 under /electrico otherwise).
const SOFA_URL = asset("/models/sofa/Sofa_01.glb");
const TABLE_URL = asset("/models/coffeetable/CoffeeTable_01.glb");
const CHAIR_URL = asset("/models/armchair/ArmChair_01.glb");
const PLANT_URL = asset("/models/pottedplant/PottedPlant.glb");

// SELF-HOST THE DRACO DECODER (was drei's gstatic CDN default). When that CDN is
// slow or blocked — common on some regional networks — the Draco-compressed
// furniture never decoded and the Room appeared EMPTY (the reported "can't see
// the sofa"). Serving the decoder from our own origin removes that dependency and
// speeds first decode. MUST run before any useGLTF(...,true)/preload below.
useGLTF.setDecoderPath(asset("/draco/"));

// preload MUST pass the same Draco flag as the load call below, or drei caches a
// non-Draco loader and the Draco-compressed mesh fails to decode.
useGLTF.preload(SOFA_URL, true);
useGLTF.preload(TABLE_URL, true);
useGLTF.preload(CHAIR_URL, true);
useGLTF.preload(PLANT_URL, true);

// Aim target for the recessed downlight — a spotLight's default target lives
// outside the scene graph (so target-position never updates its world matrix);
// a real <primitive> in the scene gives the cone something to point at. Module
// singleton (one Room) so it's allocated once, never per-frame.
const DOWNLIGHT_TARGET = new THREE.Object3D();

function enableShadows(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

export function RoomScene() {
  const tier = TIERS[useExperience((s) => s.quality)];
  // Real CC0 furniture (Poly Haven) — Draco+webp GLBs. Suspends while loading
  // (see the <Suspense> wrap in Experience). Traverse once for shadow cast/receive.
  const { scene: sofa } = useGLTF(SOFA_URL, true);
  const { scene: table } = useGLTF(TABLE_URL, true);
  const { scene: chair } = useGLTF(CHAIR_URL, true);
  const { scene: plant } = useGLTF(PLANT_URL, true);
  const uiRef = useRef<THREE.InstancedMesh>(null);
  const booksRef = useRef<THREE.InstancedMesh>(null);
  const lampLight = useRef<THREE.PointLight>(null);
  const lampFroze = useRef(false);

  // Freeze the lamp's 6-face point shadow after load (it's a static interior —
  // a per-frame cube-shadow re-render is pure waste). Driven by useProgress, NOT
  // a frame count: the GLB furniture arrives via Suspense after mount, so a
  // mount-counted freeze would lock an EMPTY shadow map on real networks.
  const { active, progress } = useProgress();
  const loaded = !active && progress === 100;

  useLayoutEffect(() => {
    enableShadows(sofa);
    enableShadows(table);
    enableShadows(chair);
    enableShadows(plant);
  }, [sofa, table, chair, plant]);

  // Lay out the wall-panel UI button grid (on the panel's +z face).
  useLayoutEffect(() => {
    const ui = uiRef.current;
    if (!ui) return;
    const o = new THREE.Object3D();
    let i = 0;
    for (let r = 0; r < UI_ROWS; r++) {
      for (let c = 0; c < UI_COLS; c++) {
        o.position.set(
          PANEL_CX + (c / (UI_COLS - 1) - 0.5) * 2.2,
          PANEL_CY + (r / (UI_ROWS - 1) - 0.5) * 1.1,
          BACK_Z + 0.22,
        );
        o.scale.set(0.3, 0.26, 0.05);
        o.updateMatrix();
        ui.setMatrixAt(i++, o.matrix);
      }
    }
    ui.instanceMatrix.needsUpdate = true;
  }, []);

  // Lay out the bookshelf books — deterministic (seeded) thin boxes across the
  // 5 shelves so the same cosy spine pattern reads every load (no camera risk:
  // all against the right wall, well out of the flight line).
  useLayoutEffect(() => {
    const b = booksRef.current;
    if (!b) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    let s = 0x51f0 >>> 0;
    const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
    let i = 0;
    for (let lvl = 0; lvl < SHELF_LEVELS - 1 && i < BOOK_COUNT; lvl++) {
      const shelfY = SHELF_Y0 + (lvl / (SHELF_LEVELS - 1)) * SHELF_H;
      let z = SHELF_Z - SHELF_W / 2 + 0.2;
      while (z < SHELF_Z + SHELF_W / 2 - 0.2 && i < BOOK_COUNT) {
        const bw = 0.12 + rng() * 0.12; // spine thickness (along z)
        const bh = 0.7 + rng() * 0.55; // book height
        const lean = rng() < 0.12 ? (rng() - 0.5) * 0.5 : 0; // an occasional leaning book
        o.position.set(SHELF_X - 0.18, shelfY + bh / 2, z + bw / 2);
        o.rotation.set(0, 0, lean);
        o.scale.set(0.5, bh, bw);
        o.updateMatrix();
        b.setMatrixAt(i, o.matrix);
        col.copy(BOOK_HUES[Math.floor(rng() * BOOK_HUES.length)]).multiplyScalar(0.5 + rng() * 0.4);
        b.setColorAt(i, col);
        i++;
        z += bw + 0.02;
      }
    }
    b.count = i;
    b.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  }, []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    DEVICE.emissiveIntensity = 1.4 + 1.0 * (0.5 + 0.5 * Math.sin(t * 1.2));
    // The home "thinks" — a column-scan of brightness sweeps the panel buttons.
    const ui = uiRef.current;
    if (ui && ui.instanceColor) {
      for (let i = 0; i < UI_COUNT; i++) {
        const b = Math.pow(0.5 + 0.5 * Math.sin(t * 2.2 - (i % UI_COLS) * 0.9), 3);
        _uiCol.copy(UI_TEAL).multiplyScalar(0.35 + b * 2.4);
        ui.setColorAt(i, _uiCol);
      }
      ui.instanceColor.needsUpdate = true;
    }

    // Freeze the lamp shadow once everything's loaded + committed for a few frames.
    const ll = lampLight.current;
    if (ll && ll.castShadow && loaded && !lampFroze.current) {
      // one needsUpdate then stop auto-updating: nothing in the room moves.
      ll.shadow.needsUpdate = true;
      ll.shadow.autoUpdate = false;
      lampFroze.current = true;
    }
  });

  return (
    <group>
      {/* === LIGHTING === */}
      {/* Warm standing-lamp light — casts the room's contact shadow (full tier
          only; frozen after load). distance contained to the interior. */}
      <pointLight
        ref={lampLight}
        position={[LAMP_X, FLOOR_Y + 5, LAMP_Z]}
        intensity={70}
        distance={26}
        color="#ffcf9a"
        castShadow={tier.heavyProps}
        shadow-mapSize={[tier.shadowMapSize, tier.shadowMapSize]}
        shadow-bias={-0.003}
      />
      {/* ONE recessed CEILING DOWNLIGHT cone over the furniture cluster — the
          domestic key. A tight spot pooling warm light onto the sofa/table/rug
          (no shadow — the lamp owns the contact shadow; this just sculpts). The
          aim target is a real scene object so the cone actually points down. */}
      <primitive object={DOWNLIGHT_TARGET} position={[A.x - 3, FLOOR_Y, A.z]} />
      <spotLight
        position={[A.x - 2, CEIL_Y - 0.3, A.z]}
        target={DOWNLIGHT_TARGET}
        color="#ffe1b0"
        intensity={120}
        distance={18}
        angle={0.55}
        penumbra={0.7}
        decay={2}
      />
      {/* Broad WARM FILL flooding the furniture cluster + walls so the room reads
          as warm and domestic, OVERPOWERING the global cool moon key (Lighting.tsx
          directional #9ec3ff) that otherwise rakes the wall edges/door-jamb as
          cold blue diagonals. Wide distance, no shadow — pure ambient warmth that
          makes the sofa/table/chair clearly, invitingly lit at the p≈0.61 park. */}
      <pointLight position={[A.x - 2, FLOOR_Y + 6, A.z + 2]} color="#ffcf9a" intensity={55} distance={34} decay={2} />
      {/* Second warm bounce low in the cluster — lifts the rug + sofa base out of
          black so the contact shadow reads against lit fabric, not a dark void. */}
      <pointLight position={[A.x - 3, FLOOR_Y + 1.5, A.z + 1]} color="#ffdcab" intensity={26} distance={18} decay={2} />
      {/* Cool fill bleeding in from the night-city window (motivated by the glow).
          KEPT SUBTLE: warmed toward steel-blue and dimmed so it tints the window
          area, never reads as a competing cold diagonal across the warm interior. */}
      <pointLight position={[WIN_CX, WIN_CY, BACK_Z + 2]} color="#7a93c0" intensity={13} distance={13} decay={2} />

      {/* === DOMESTIC SHELL: floor + ceiling + 3 walls (front open) === */}
      {/* Floor — catches the lamp + downlight shadow/pool. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROOM_CX, FLOOR_Y, ROOM_CZ]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#1b1410" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Ceiling — closes the room overhead (a warehouse has none); faces down. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[ROOM_CX, CEIL_Y, ROOM_CZ]} material={CEIL} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
      </mesh>
      {/* Recessed downlight housing on the ceiling (a small dark trim + glow disc). */}
      <mesh position={[A.x - 2, CEIL_Y - 0.06, A.z]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.5, 24]} />
        <meshStandardMaterial color="#15110c" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[A.x - 2, CEIL_Y - 0.08, A.z]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 24]} />
        <meshBasicMaterial color="#ffe1b0" toneMapped={false} />
      </mesh>

      {/* LEFT wall. */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[X_LEFT, FLOOR_Y + WALL_H / 2, ROOM_CZ]} material={WALL} receiveShadow>
        <planeGeometry args={[ROOM_D, WALL_H]} />
      </mesh>
      {/* RIGHT wall (the bookshelf hangs on this one). */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[X_RIGHT, FLOOR_Y + WALL_H / 2, ROOM_CZ]} material={WALL} receiveShadow>
        <planeGeometry args={[ROOM_D, WALL_H]} />
      </mesh>
      {/* BACK wall — built in 4 segments AROUND the doorway + the city window, so
          the camera threads the doorway opening (no solid pane on the flight line).
          Segment math: full wall minus the door rectangle. */}
      {/* below the door (full width) */}
      <mesh position={[ROOM_CX, FLOOR_Y + (DOOR_Y - DOOR_HH - FLOOR_Y) / 2, BACK_Z]} material={WALL} receiveShadow>
        <planeGeometry args={[ROOM_W, Math.max(0.01, DOOR_Y - DOOR_HH - FLOOR_Y)]} />
      </mesh>
      {/* above the door (full width) */}
      <mesh position={[ROOM_CX, (DOOR_Y + DOOR_HH + CEIL_Y) / 2, BACK_Z]} material={WALL} receiveShadow>
        <planeGeometry args={[ROOM_W, Math.max(0.01, CEIL_Y - (DOOR_Y + DOOR_HH))]} />
      </mesh>
      {/* left of the door (between left wall and door, full mid height) */}
      <mesh
        position={[(X_LEFT + (DOOR_X - DOOR_HW)) / 2, DOOR_Y, BACK_Z]}
        material={WALL}
        receiveShadow
      >
        <planeGeometry args={[Math.max(0.01, (DOOR_X - DOOR_HW) - X_LEFT), DOOR_HH * 2]} />
      </mesh>
      {/* right of the door (between door and right wall) */}
      <mesh
        position={[((DOOR_X + DOOR_HW) + X_RIGHT) / 2, DOOR_Y, BACK_Z]}
        material={WALL}
        receiveShadow
      >
        <planeGeometry args={[Math.max(0.01, X_RIGHT - (DOOR_X + DOOR_HW)), DOOR_HH * 2]} />
      </mesh>

      {/* Emissive DOORWAY JAMB ring — the diegetic "exit here" threshold. Three
          bars (sides + head) hugging the opening. Lit Standard → toneMapped:true. */}
      {(
        [
          [DOOR_X, DOOR_Y + DOOR_HH + 0.15, DOOR_HW * 2 + 0.5, 0.3], // head
          [DOOR_X - DOOR_HW - 0.15, DOOR_Y, 0.3, DOOR_HH * 2 + 0.3], // left jamb
          [DOOR_X + DOOR_HW + 0.15, DOOR_Y, 0.3, DOOR_HH * 2 + 0.3], // right jamb
        ] as [number, number, number, number][]
      ).map(([cx, cy, w, h], i) => (
        <mesh key={i} position={[cx, cy, BACK_Z + 0.12]} material={DOOR_JAMB}>
          <boxGeometry args={[w, h, 0.24]} />
        </mesh>
      ))}
      {/* A cool glow behind the doorway so the opening reads as a lit threshold the
          camera flies into (the dim-5 wiring corridor lies beyond). Dimmed + its
          distance tightened so the cool light stays INSIDE the doorway opening and
          stops bleeding onto the back-wall segments as a cold diagonal. */}
      <pointLight position={[DOOR_X, DOOR_Y, BACK_Z - 2]} color="#9fd0ff" intensity={12} distance={7} decay={2} />

      {/* NIGHT-CITY WINDOW (left of the doorway) — frame + a glowing pane showing
          the dim-1 city beyond. Ties the Room back to the City (the dive's loop). */}
      <mesh position={[WIN_CX, WIN_CY, BACK_Z + 0.06]} material={CITY_GLOW}>
        <planeGeometry args={[WIN_W, WIN_H]} />
      </mesh>
      {/* Scattered warm/cool "distant windows" on the city-glow pane — instanced
          would be overkill for ~10; a few static emissive specks read as a skyline. */}
      {[
        [-2.2, 1.2, "#ffc46b", 0.9], [-1.2, -0.6, "#ffb24d", 0.7], [-0.3, 0.9, "#bcd2ff", 0.6],
        [0.6, -1.1, "#ffc46b", 0.8], [1.4, 0.4, "#ffb24d", 0.7], [2.1, 1.4, "#bcd2ff", 0.5],
        [-2.4, -1.3, "#ffc46b", 0.6], [0.1, 1.6, "#ffb24d", 0.5], [1.9, -0.8, "#ffc46b", 0.7],
      ].map(([dx, dy, c, b], i) => (
        <mesh key={i} position={[WIN_CX + (dx as number), WIN_CY + (dy as number), BACK_Z + 0.1]}>
          <planeGeometry args={[0.22, 0.42]} />
          <meshBasicMaterial color={new THREE.Color(c as string).multiplyScalar(b as number)} toneMapped={false} />
        </mesh>
      ))}
      {/* Window frame mullions (cross). */}
      {[
        [0, 0, WIN_W + 0.4, 0.18], [0, 0, 0.18, WIN_H + 0.4],
      ].map(([dx, dy, w, h], i) => (
        <mesh key={i} position={[WIN_CX + (dx as number), WIN_CY + (dy as number), BACK_Z + 0.12]} material={WOOD}>
          <boxGeometry args={[w as number, h as number, 0.12]} />
        </mesh>
      ))}

      {/* === STANDING LAMP === */}
      <mesh position={[LAMP_X, FLOOR_Y + 2.5, LAMP_Z]} material={WOOD} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 5, 8]} />
      </mesh>
      <mesh position={[LAMP_X, FLOOR_Y + 5, LAMP_Z]} material={LAMP}>
        <sphereGeometry args={[0.5, 18, 18]} />
      </mesh>

      {/* === REAL FURNITURE (Poly Haven CC0, Draco GLB) === */}
      <primitive object={sofa} position={[A.x - 3, FLOOR_Y, A.z + 1]} scale={5.5} rotation={[0, Math.PI, 0]} />
      <primitive object={table} position={[A.x - 3, FLOOR_Y, A.z - 1.5]} scale={5} rotation={[0, 0.4, 0]} />
      <primitive object={chair} position={[A.x + 3, FLOOR_Y, A.z + 2]} scale={5} rotation={[0, -0.9, 0]} />
      {/* Potted plant (replaces the old icosphere plant) — life + a green accent
          against the warm interior, scaled to match the ~5–5.5× furniture pipeline. */}
      <primitive object={plant} position={[A.x + 4.5, FLOOR_Y, A.z - 2]} scale={5} />
      {/* Rug grounding the cluster. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[A.x - 4, FLOOR_Y + 0.03, A.z + 1]} material={RUG} receiveShadow>
        <planeGeometry args={[7.5, 5.5]} />
      </mesh>

      {/* === BOOKSHELF: a back panel + 5 real shelf boards + instanced books === */}
      <mesh position={[SHELF_X, SHELF_Y0 + SHELF_H / 2, SHELF_Z]} material={SHELF} castShadow receiveShadow>
        <boxGeometry args={[0.4, SHELF_H + 0.6, SHELF_W + 0.4]} />
      </mesh>
      {Array.from({ length: SHELF_LEVELS }).map((_, lvl) => (
        <mesh
          key={lvl}
          position={[SHELF_X - 0.18, SHELF_Y0 + (lvl / (SHELF_LEVELS - 1)) * SHELF_H, SHELF_Z]}
          material={SHELF}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.75, 0.08, SHELF_W]} />
        </mesh>
      ))}
      <instancedMesh ref={booksRef} args={[undefined, undefined, BOOK_COUNT]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.82} metalness={0.02} />
      </instancedMesh>

      {/* === SMART DEVICES (teal) === wall panel + speaker + sensor + hub. The
          panel sits on the back wall between the night-city window and the doorway. */}
      <mesh position={[PANEL_CX, PANEL_CY, BACK_Z + 0.14]} material={DEVICE}>
        <boxGeometry args={[2.8, 1.8, 0.12]} />
      </mesh>
      <mesh position={[A.x - 4, FLOOR_Y + 0.95, A.z - 0.6]} material={DEVICE} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.4]} />
      </mesh>
      <mesh position={[LAMP_X, FLOOR_Y + 0.3, LAMP_Z + 1.5]} material={DEVICE} castShadow>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
      </mesh>
      {/* Smart hub / speaker in the cluster — a glowing teal ring (the home's voice). */}
      <mesh position={[A.x - 1, FLOOR_Y + 0.5, A.z]} material={WOOD}>
        <cylinderGeometry args={[0.42, 0.5, 1, 18]} />
      </mesh>
      <mesh position={[A.x - 1, FLOOR_Y + 1.02, A.z]} rotation={[Math.PI / 2, 0, 0]} material={DEVICE}>
        <torusGeometry args={[0.38, 0.09, 10, 24]} />
      </mesh>
      {/* Animated control-panel UI on the wall screen — the home "thinking". */}
      <instancedMesh ref={uiRef} args={[undefined, undefined, UI_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Dev-only camera-safety assert: the camera must thread the OPEN front and the
// back-wall DOORWAY without hitting a solid plane. Prints the actual crossings so
// the doorway can be re-centred if the authored path is ever retuned.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const _p = new THREE.Vector3();
  const _l = new THREE.Vector3();
  let prev: { x: number; y: number; z: number; p: number } | null = null;
  for (let p = 0.54; p <= 0.72; p += 0.0005) {
    sampleCamera(p, _p, _l);
    if (prev && prev.z > BACK_Z && _p.z <= BACK_Z) {
      const t = (BACK_Z - prev.z) / (_p.z - prev.z);
      const cx = prev.x + (_p.x - prev.x) * t;
      const cy = prev.y + (_p.y - prev.y) * t;
      if (Math.abs(cx - DOOR_X) > DOOR_HW - 0.5 || Math.abs(cy - DOOR_Y) > DOOR_HH - 0.5) {
        console.warn(
          `[RoomScene] camera exit may clip the back wall — crosses z=${BACK_Z} ` +
            `at (${cx.toFixed(2)}, ${cy.toFixed(2)}); doorway ${DOOR_X}±${DOOR_HW}, ${DOOR_Y}±${DOOR_HH}.`,
        );
      }
      break;
    }
    prev = { x: _p.x, y: _p.y, z: _p.z, p };
  }
}
