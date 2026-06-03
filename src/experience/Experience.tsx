"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { createRenderer } from "@/src/three/createRenderer";
import { useSmoothScroll } from "@/src/hooks/useSmoothScroll";
import { ScrollDebug } from "@/src/ui/ScrollDebug";

/**
 * M0 placeholder: a single lit, slowly rotating cube that proves the render loop
 * runs through our WebGL2 renderer factory at a clean 60fps. It is replaced by
 * the scroll-driven Rig + DimensionManager in M1/M2.
 *
 * Amber + emissive on a deep-night background previews the spec's "power /
 * electrical" colour category (§6) so M0 already reads on-brand.
 */
function PowerCube() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.x = t * 0.35;
    ref.current.rotation.y = t * 0.55;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial
        color="#e8a23d"
        emissive="#7a3c06"
        emissiveIntensity={0.4}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  );
}

/**
 * The 3D experience island (a client component). Mounts one <Canvas> behind the
 * page's real HTML content and wires Lenis -> store. There is intentionally NO
 * drei <ScrollControls> here: Lenis owns smooth scroll on the DOM and the Rig
 * (M1) will read the store's `progress` in useFrame to fly the single camera.
 */
export function Experience() {
  useSmoothScroll();

  return (
    <>
      <div className="experience-root">
        <Canvas
          gl={createRenderer}
          dpr={[1, 2]}
          camera={{ fov: 50, near: 0.1, far: 2000, position: [0, 0, 5] }}
        >
          <color attach="background" args={["#05070d"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 5, 6]} intensity={2.4} color="#ffd9a0" />
          <PowerCube />
        </Canvas>
      </div>
      <ScrollDebug />
    </>
  );
}
