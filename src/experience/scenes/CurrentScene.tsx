import { useFrame } from "@react-three/fiber";
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
function buildGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const position = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * Math.random() * 6.5; // denser toward the core
    position[i * 3] = Math.cos(a) * r;
    position[i * 3 + 1] = Math.sin(a) * r;
    position[i * 3 + 2] = (Math.random() - 0.5) * SPAN;
    seed[i] = Math.random();
  }
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  return g;
}
const CURRENT_GEOMETRY = buildGeometry();

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

export function CurrentScene() {
  useFrame((_, dt) => {
    UNIFORMS.uTime.value += dt;
  });

  return (
    <points geometry={CURRENT_GEOMETRY} position={[CURRENT.x, CURRENT.y, CURRENT.z - 6]}>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={UNIFORMS}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
