import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { ZONES } from "../cameraPath";

/**
 * Dimension 6 — The Live Current (spec §7). Pure flowing energy: the brightest,
 * most sublime layer. A few hundred additive particles stream toward the viewer
 * in a vertex shader (verb: FLOW), blooming into radiant filaments of light.
 * Sits at the dimension-6 anchor; the camera ends just in front, so it fills
 * the final frame and is the natural hand-off into the M3 loop back to the city.
 */

const CURRENT = ZONES[ZONES.length - 1].position;
const COUNT = 650;
const SPAN = 44; // length of the flow tube along z (loops within this)

// Geometry built once at module scope (Math.random out of the render phase).
function buildGeometry(count: number, maxR: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * Math.random() * maxR; // denser toward the core
    position[i * 3] = Math.cos(a) * r;
    position[i * 3 + 1] = Math.sin(a) * r;
    position[i * 3 + 2] = (Math.random() - 0.5) * SPAN;
    seed[i] = Math.random();
  }
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  return g;
}
const CURRENT_GEOMETRY = buildGeometry(COUNT, 6.5);
// Secondary inner swirl — cooler, slower, tighter — adds depth + rhythm behind the
// warm flow (a second harmonic of the current).
const SECONDARY_GEOMETRY = buildGeometry(280, 3.2);

const VERT = /* glsl */ `
  uniform float uTime;
  attribute float aSeed;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    // Stream toward the viewer (+z), looping within SPAN.
    float span = ${SPAN.toFixed(1)};
    p.z = mod(position.z + uTime * (10.0 + aSeed * 10.0) + aSeed * span, span) - span * 0.5;
    // Gentle swirl so filaments twist as they flow.
    float ang = uTime * 0.5 + aSeed * 6.2831;
    float swirl = 0.5 * aSeed;
    p.xy += vec2(cos(ang), sin(ang)) * swirl;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (300.0 / max(-mv.z, 0.1)) * (0.4 + aSeed * 0.9);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vSeed;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r);
    vec3 col = uColor * (1.3 + vSeed * 1.2);
    gl_FragColor = vec4(col * a, a);
  }
`;

// Module-scope uniforms (mutable, single CurrentScene instance) so the per-frame
// uTime write isn't modifying a hook value (React Compiler immutability rule).
const UNIFORMS = {
  uTime: { value: 0 },
  uColor: { value: new THREE.Color("#ffae3a") },
};
const SECONDARY_UNIFORMS = {
  uTime: { value: 0 },
  uColor: { value: new THREE.Color("#5a8cff") },
};

// Radial discharge arcs — bright blue-white bolts flaring from the core outward.
const ARC_COUNT = 12;
const ARC_COL = new THREE.Color("#bfe6ff");
const _ad = new THREE.Object3D();
const _ac = new THREE.Color();
const _adir = new THREE.Vector3();
const _aq = new THREE.Quaternion();
const _aY = new THREE.Vector3(0, 1, 0);

export function CurrentScene() {
  const coreRef = useRef<THREE.Mesh>(null);
  const arcsRef = useRef<THREE.InstancedMesh>(null);
  const arcBright = useRef<number[]>([]);

  useLayoutEffect(() => {
    const m = arcsRef.current;
    if (!m) return;
    const b: number[] = [];
    for (let i = 0; i < ARC_COUNT; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      _adir.set(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph) * 0.5).normalize();
      const len = 4 + Math.random() * 2.5;
      _aq.setFromUnitVectors(_aY, _adir);
      _ad.position.copy(_adir).multiplyScalar(len / 2);
      _ad.quaternion.copy(_aq);
      _ad.scale.set(0.06, len, 0.06);
      _ad.updateMatrix();
      m.setMatrixAt(i, _ad.matrix);
      _ac.setRGB(0, 0, 0);
      m.setColorAt(i, _ac);
      b.push(Math.random());
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    arcBright.current = b;
  }, []);

  useFrame((_, dt) => {
    UNIFORMS.uTime.value += dt;
    SECONDARY_UNIFORMS.uTime.value += dt * 0.45; // slower harmonic
    const t = UNIFORMS.uTime.value;
    const core = coreRef.current;
    if (core) core.scale.setScalar(1.1 + 0.4 * Math.sin(t * 2.2) + 0.18 * Math.sin(t * 6.1));
    // Discharge arcs flare + fade at random (electrical discharge from the core).
    const m = arcsRef.current;
    if (m && m.instanceColor) {
      const b = arcBright.current;
      for (let i = 0; i < b.length; i++) {
        b[i] -= dt * 2.5;
        if (b[i] < 0) b[i] = Math.random() < 0.5 ? 1.4 + Math.random() * 1.6 : 0;
        _ac.copy(ARC_COL).multiplyScalar(Math.max(0, b[i]));
        m.setColorAt(i, _ac);
      }
      m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={[CURRENT.x, CURRENT.y, CURRENT.z - 6]}>
      <points geometry={CURRENT_GEOMETRY}>
        <shaderMaterial
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Secondary cooler/slower inner swirl — depth + rhythm. */}
      <points geometry={SECONDARY_GEOMETRY}>
        <shaderMaterial
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={SECONDARY_UNIFORMS}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Living core — a bright pulsing heart the filaments stream from. */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.2, 24, 24]} />
        <meshBasicMaterial
          color="#ffd98a"
          toneMapped={false}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Radial discharge arcs — electric bolts flaring from the core outward. */}
      <instancedMesh ref={arcsRef} args={[undefined, undefined, ARC_COUNT]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
