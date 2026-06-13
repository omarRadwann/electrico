import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";
import { useSurfaceMaps } from "../useSurfaceMaps";
import { asset } from "@/src/lib/asset";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "../quality";
import { SURGE_NODES, SURGE_COUNT } from "./FrameSurge";

/**
 * Dimension 3 — The Steel Frame (spec §7): the hidden order beneath the surface.
 *
 * THE HEADLINE FIX (briefing §9-12): this was a uniform neon "Tron cage" — one
 * global sine drove identical emissive onto every member, drowning the metal maps,
 * the raking spot and the bolts. It now reads as STEEL UNDER LOAD:
 *
 *  - MATERIAL TRUTH: dark PBR steel — toneMapped:true (the lit response goes
 *    through the AgX grade, not clipped neon), metalness 0.86, roughness from the
 *    metal_rough map, a low 0.14 emissive FLOOR. The raking spot + back-rim +
 *    normal/roughness maps + the now-live IBL/shadows MODEL the surface instead of
 *    a flat self-illumination washing it out.
 *  - SURGE-LIT STEEL (the signature, §10): the FrameSurge nodes publish their
 *    world positions into the shared SURGE_NODES array; here each beam's
 *    instanceColor is set every other frame to base + glow×proximity-falloff to
 *    the nearest node. A patched MeshStandardMaterial multiplies emissive by
 *    instanceColor (onBeforeCompile) — so the travelling pulses LITERALLY light
 *    the members they ride, member by member, instead of floating as a separate
 *    glow. The pulse is now a property of the steel.
 *  - DEPTH (§11): THREE chained bays along −Z make the fly-through a real tunnel
 *    of receding structure, and an 8-vertex I-beam profile (extruded, instanced)
 *    gives the members a rolled-section silhouette instead of square box-tube.
 *  - BOLTS/GUSSETS (§12): a separate low-emissive steel material at the joints so
 *    the detail catches the key light and READS, instead of being buried in glow.
 *
 * The cage is open down its centreline; the camera flies (2.5, 2, z) through the
 * void between the perimeter columns (x = A.x±S = −3.5 / 8.5) — see cameraSafety.
 */

const A = ZONES[2].position; // (2.5, 2, -102)
const MAX_BEAMS = 240; // 3 bays × ~26 members + slack
const S = 6; // half-span between columns
const H = 30;
const LEVELS = 5;
const TH = 0.26; // member depth — at fly-through distance 0.16 was sub-pixel wire

// Shared spotlight aim target (one Frame scene → module singleton).
const FRAME_TARGET = new THREE.Object3D();
// THREE connected bays along −Z (the camera's forward look): a real tunnel of
// steel receding ahead, not a single sparse cube. z spans continuous −96..−132.
const BAY_Z = [A.z, A.z - 2 * S, A.z - 4 * S]; // -102, -114, -126

// Surge → emissive tuning. A node within FALLOFF_R of a beam's mid-point pushes
// that beam's instanceColor up toward GLOW; beyond it the beam sits at BASE
// (instanceColor 1.0 → emissive floor only). Squared-distance falloff is cheap
// and reads as a soft halo riding the member.
const FALLOFF_R = 4.2;
const FALLOFF_R2 = FALLOFF_R * FALLOFF_R;
const BASE_C = 1.0; // instanceColor at rest → emissive × 1 (the 0.14 floor)
const GLOW_C = 9.0; // peak instanceColor under a node → bright loaded steel

// Module-scope temporaries — reused while laying out / animating beams.
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);
const _col = new THREE.Color();

/**
 * 8-vertex I-beam cross-section extruded along local +x as a UNIT-length member
 * (length 1, profile fits within ±0.5 in y/z) so the existing instance-matrix
 * idiom — scale.x = member length, scale.y/z = thickness — works unchanged. The
 * I silhouette (flanges top/bottom + web) reads as rolled structural steel under
 * the raking key, where a box-tube read as generic strut.
 */
function makeIBeamGeometry(): THREE.BufferGeometry {
  const fw = 0.5; // flange half-width (z)
  const fh = 0.5; // overall half-height (y)
  const ft = 0.16; // flange thickness
  const wt = 0.14; // web half-thickness (z)
  // I cross-section in the y(height)–z(width) plane, CCW.
  const shape = new THREE.Shape();
  shape.moveTo(-fh, -fw);
  shape.lineTo(-fh, fw);
  shape.lineTo(-fh + ft, fw);
  shape.lineTo(-fh + ft, wt);
  shape.lineTo(fh - ft, wt);
  shape.lineTo(fh - ft, fw);
  shape.lineTo(fh, fw);
  shape.lineTo(fh, -fw);
  shape.lineTo(fh - ft, -fw);
  shape.lineTo(fh - ft, -wt);
  shape.lineTo(-fh + ft, -wt);
  shape.lineTo(-fh + ft, -fw);
  shape.closePath();
  // Extrude along +Z then rotate so the member axis is local +X (matching _X /
  // the scale.x = length convention). Centre the length on the origin.
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geo.translate(0, 0, -0.5);
  geo.rotateY(Math.PI / 2); // extrude axis Z → member axis X
  geo.computeVertexNormals();
  return geo;
}

export function FrameScene() {
  const tier = TIERS[useExperience((s) => s.quality)];
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const boltsRef = useRef<THREE.InstancedMesh>(null);
  const frameSpot = useRef<THREE.SpotLight>(null);
  const spotWarm = useRef(0);
  // Beam mid-points cached at layout (the surge-proximity test runs each frame).
  const midpts = useRef<Float32Array>(new Float32Array(MAX_BEAMS * 3));
  const beamCount = useRef(0);
  const frameParity = useRef(0);

  // I-beam profile — one geometry instanced across all members (one draw call).
  const beamGeo = useMemo(() => makeIBeamGeometry(), []);

  // Brushed-metal relief on the steel between the surge-lit members.
  const metal = useSurfaceMaps(
    asset("/textures/metal_nor_gl_1k.jpg"),
    asset("/textures/metal_rough_1k.jpg"),
    1,
    2,
  );

  // Patch the standard material so per-instance instanceColor drives EMISSIVE,
  // not albedo. LIBRARY-BOUNDARY TRAP (verified in three 0.184 src): an
  // InstancedMesh with an instanceColor buffer makes three define USE_COLOR (not
  // just USE_INSTANCING_COLOR) and run `diffuseColor *= vColor` — so by default
  // instanceColor would blow out the steel's ALBEDO white at our GLOW values, the
  // opposite of "dark steel that lights up". We therefore (a) carry the
  // per-instance mask on our OWN varying vSurge — independent of three's vColor
  // define-guard fragility — and (b) cancel the default albedo tint by neutering
  // color_fragment, so the surge lifts ONLY self-illumination. This is
  // onBeforeCompile on a real MeshStandardMaterial (no R3F <shaderMaterial>
  // uniform-clone trap applies).
  const patchEmissive = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      // `attribute vec3 instanceColor;` is already injected by three's vertex
      // prefix (USE_INSTANCING_COLOR is on once an instanceColor buffer exists) —
      // we must NOT redeclare it, only add our varying and read it.
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vSurge;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n\tvSurge = instanceColor.r;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vSurge;",
        )
        // Neuter three's default instanceColor→albedo tint (it sets USE_COLOR).
        .replace("#include <color_fragment>", "")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          // vSurge = per-instance surge mask (1 = rest floor, up to ~9 under a
          // node). Driving emissive by it makes the travelling pulse a property of
          // the STEEL; peaks clear the 0.55 bloom threshold pre-tonemap while the
          // dark albedo is preserved.
          totalEmissiveRadiance *= vSurge;`,
        );
    },
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const mids = midpts.current;
    let i = 0;

    // Place one I-beam member spanning a->b (local +x aligned to the axis) and
    // cache its mid-point for the per-frame surge-proximity test.
    const setBeam = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      thick: number,
    ) => {
      if (i >= MAX_BEAMS) return;
      _a.set(ax, ay, az);
      _b.set(bx, by, bz);
      _mid.copy(_a).lerp(_b, 0.5);
      _dir.copy(_b).sub(_a).normalize();
      _q.setFromUnitVectors(_X, _dir);
      dummy.position.copy(_mid);
      dummy.quaternion.copy(_q);
      dummy.scale.set(_a.distanceTo(_b), thick, thick);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, _col.setScalar(BASE_C)); // rest = emissive floor only
      const o = i * 3;
      mids[o] = _mid.x;
      mids[o + 1] = _mid.y;
      mids[o + 2] = _mid.z;
      i++;
    };

    const yBot = A.y - H / 2;
    const yTop = A.y + H / 2;

    // One braced bay centred at depth `zc`. Three chained along −Z give the
    // tunnel; columns slightly fatter than ring/brace members (real structure).
    const buildCage = (zc: number) => {
      const cx = [A.x - S, A.x + S, A.x + S, A.x - S];
      const cz = [zc - S, zc - S, zc + S, zc + S];

      // 4 corner columns.
      for (let k = 0; k < 4; k++) setBeam(cx[k], yBot, cz[k], cx[k], yTop, cz[k], 0.36);

      // Perimeter ring beams at each level.
      for (let l = 0; l < LEVELS; l++) {
        const y = yBot + (l / (LEVELS - 1)) * H;
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          setBeam(cx[k], y, cz[k], cx[n], y, cz[n], TH);
        }
      }

      // Zig-zag diagonal cross-bracing on every side face — the structural signature.
      for (let l = 0; l < LEVELS - 1; l++) {
        const y0 = yBot + (l / (LEVELS - 1)) * H;
        const y1 = yBot + ((l + 1) / (LEVELS - 1)) * H;
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4;
          if ((l + k) % 2 === 0) setBeam(cx[k], y0, cz[k], cx[n], y1, cz[n], TH);
          else setBeam(cx[n], y0, cz[n], cx[k], y1, cz[k], TH);
        }
      }

      // X-braces across the floor and ceiling planes — reads as a complete truss.
      for (const y of [yBot, yTop]) {
        setBeam(cx[0], y, cz[0], cx[2], y, cz[2], TH);
        setBeam(cx[1], y, cz[1], cx[3], y, cz[3], TH);
      }
    };

    for (const zc of BAY_Z) buildCage(zc);

    beamCount.current = i;
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Bolt / gusset studs at the column–ring joints — engineering craft detail.
    const bolts = boltsRef.current;
    if (bolts) {
      let bj = 0;
      for (const zc of BAY_Z) {
        const cx = [A.x - S, A.x + S, A.x + S, A.x - S];
        const cz = [zc - S, zc - S, zc + S, zc + S];
        for (let l = 0; l < LEVELS; l++) {
          const y = yBot + (l / (LEVELS - 1)) * H;
          for (let k = 0; k < 4; k++) {
            dummy.position.set(cx[k], y, cz[k]);
            dummy.quaternion.identity();
            dummy.scale.setScalar(0.3);
            dummy.updateMatrix();
            if (bj < 60) bolts.setMatrixAt(bj++, dummy.matrix);
          }
        }
      }
      bolts.count = bj;
      bolts.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame((s) => {
    // MATERIAL TRUTH: a faint global breath on the FLOOR (loaded-but-idle), an
    // order of magnitude below the old 2.3±0.45 wash that drowned the maps. Floor
    // lowered (0.14 → 0.10) + the emissive desaturated so the resting cage reads as
    // DARK metallic steel at reduced tier, not a uniformly blue neon cage — the
    // surge nodes stay the accent. The visible energy comes from the surge mask
    // below, not this.
    if (matRef.current) {
      // Floor raised 0.1 → 0.5: at 0.1 the cage was invisible (only surge nodes
      // showed as floating bright bits). 0.5 keeps the WHOLE steel cage legibly
      // glowing as structure, with the GLOW_C surge as the bright accent on top.
      matRef.current.emissiveIntensity = 0.5 + 0.08 * Math.sin(s.clock.elapsedTime * 1.4);
    }

    // SURGE-LIT STEEL: brighten each beam's instanceColor by proximity to the
    // nearest live surge node. Throttled to every OTHER frame (the uploads are
    // the cost; the surge moves slowly enough that 30Hz is invisible) — briefing
    // §10. Reduced/minimal still run this: it is the dimension's one-verb motion,
    // not an ornamental extra, and it costs one buffer upload, not a draw.
    const mesh = ref.current;
    frameParity.current ^= 1;
    if (mesh && mesh.instanceColor && frameParity.current === 0) {
      const mids = midpts.current;
      const n = beamCount.current;
      for (let b = 0; b < n; b++) {
        const o = b * 3;
        const mx = mids[o];
        const my = mids[o + 1];
        const mz = mids[o + 2];
        // Nearest-node squared distance (cheap; SURGE_COUNT is 14).
        let best = Infinity;
        for (let k = 0; k < SURGE_COUNT; k++) {
          const so = k * 3;
          const dx = mx - SURGE_NODES[so];
          const dy = my - SURGE_NODES[so + 1];
          const dz = mz - SURGE_NODES[so + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < best) best = d2;
        }
        // Smooth halo: 1 at the node, →0 at FALLOFF_R (squared, so it tightens).
        const t = best >= FALLOFF_R2 ? 0 : 1 - best / FALLOFF_R2;
        const c = BASE_C + (GLOW_C - BASE_C) * t * t;
        mesh.setColorAt(b, _col.setScalar(c));
      }
      mesh.instanceColor.needsUpdate = true;
    }

    // PERF: freeze the static frame key-spot shadow map after a short warmup (full tier).
    const sp = frameSpot.current;
    if (sp && tier.heavyProps) {
      if (spotWarm.current < 12) spotWarm.current += 1;
      else if (sp.shadow.autoUpdate) sp.shadow.autoUpdate = false;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[beamGeo, undefined, MAX_BEAMS]}
        frustumCulled={false}
        castShadow
        receiveShadow
      >
        {/* Dark PBR steel: toneMapped TRUE (lit response through the AgX grade),
            high metalness, roughness from the map. emissive is the surge channel
            (multiplied by per-instance vColor in patchEmissive); the 0.14 floor
            keeps idle steel a faint blueprint ember, the GLOW under a node clears
            the bloom threshold. NO toneMapped:false here — that was the cheap-neon
            cause (briefing §4.3 #4). */}
        <meshStandardMaterial
          ref={matRef}
          color="#161b24"
          emissive="#6f86b8"
          emissiveIntensity={0.5}
          toneMapped
          metalness={0.9}
          roughness={0.66}
          normalMap={metal.normalMap}
          roughnessMap={metal.roughnessMap}
          onBeforeCompile={patchEmissive}
          // onBeforeCompile-derived programs are cached by this key; bump if the
          // patch source changes so three recompiles instead of reusing a stale
          // program (a real R3F/three gotcha with custom-compiled standard mats).
          customProgramCacheKey={() => "frame-steel-surge-v1"}
        />
      </instancedMesh>

      {/* Bolt / gusset studs at the joints — SEPARATE low-emissive steel so the
          detail catches the raking key and READS as forged hardware, instead of
          being buried in the member glow (briefing §12). toneMapped:true. */}
      <instancedMesh ref={boltsRef} args={[undefined, undefined, 60]} frustumCulled={false} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#171b22" emissive="#24304a" emissiveIntensity={0.25} metalness={0.9} roughness={0.4} toneMapped />
      </instancedMesh>

      {/* Cool raking KEY gives the truss a lit/dark gradient + catches the metal &
          normal maps as moving specular; back-rim peels the bones off the void;
          self-shadow (full tier) turns flat ribbons into 3D box-section steel. Both
          lights sit >9u lateral of the x=2.5 flight line. */}
      <primitive object={FRAME_TARGET} position={[A.x, A.y, A.z - 6]} />
      <spotLight
        ref={frameSpot}
        position={[A.x + 12, A.y + 9, A.z + 10]}
        target={FRAME_TARGET}
        color="#9fc0ff"
        intensity={340}
        distance={64}
        decay={2}
        angle={0.72}
        penumbra={0.5}
        castShadow={tier.heavyProps}
        shadow-mapSize={[tier.shadowMapSize, tier.shadowMapSize]}
        shadow-bias={-0.0006}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      <pointLight position={[A.x - 11, A.y + 3, A.z - 22]} color="#7aa5ff" intensity={150} distance={46} decay={2} />
    </group>
  );
}
