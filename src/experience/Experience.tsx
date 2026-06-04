"use client";

import { Canvas } from "@react-three/fiber";
import { createRenderer } from "@/src/three/createRenderer";
import { useSmoothScroll } from "@/src/hooks/useSmoothScroll";
import { ScrollDebug } from "@/src/ui/ScrollDebug";
import { Rig } from "./Rig";
import { PlaceholderZones } from "./PlaceholderZones";

/**
 * The 3D experience island (a client component). One <Canvas>, one camera (the
 * Rig), behind the page's real HTML content. There is intentionally NO drei
 * <ScrollControls>: Lenis owns smooth scroll on the DOM and the Rig reads the
 * store's `progress` in useFrame to fly the camera.
 *
 * M1 scope = the scroll-as-camera SPINE with placeholder zones. Real scenes,
 * render-target transitions, postprocessing and audio arrive in later milestones.
 */
export function Experience() {
  useSmoothScroll();

  return (
    <>
      <div className="experience-root">
        <Canvas
          gl={createRenderer}
          dpr={[1, 2]}
          camera={{ fov: 55, near: 0.1, far: 2000, position: [0, 0, 8] }}
        >
          {/* Single continuous "night" world; per-layer fog/grade comes in M3. */}
          <color attach="background" args={["#05070d"]} />
          <fog attach="fog" args={["#05070d", 14, 130]} />

          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 4]} intensity={1.2} color="#cdd6ff" />

          <Rig />
          <PlaceholderZones />
        </Canvas>
      </div>
      <ScrollDebug />
    </>
  );
}
