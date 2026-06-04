"use client";

import { Canvas } from "@react-three/fiber";
import { createRenderer } from "@/src/three/createRenderer";
import { useSmoothScroll } from "@/src/hooks/useSmoothScroll";
import { ScrollDebug } from "@/src/ui/ScrollDebug";
import { Rig } from "./Rig";
import { Atmosphere } from "./Atmosphere";
import { PlaceholderZones } from "./PlaceholderZones";
import { CityScene } from "./scenes/CityScene";
import { CurrentScene } from "./scenes/CurrentScene";
import { Effects } from "./Effects";

/**
 * The 3D experience island. One <Canvas>, one camera (the Rig), one continuous
 * night world behind the page's real HTML content. Lenis owns DOM smooth-scroll
 * (no drei <ScrollControls>); the Rig reads store `progress` in useFrame.
 *
 * Scene content lives along the camera's dive path: the City opens it, gateway
 * rings mark the middle dimensions, the Current closes it. Atmosphere shifts fog
 * + background per layer; Effects adds the bloom that makes the glow read.
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
          {/* Single continuous "night" world; Atmosphere shifts these per layer. */}
          <color attach="background" args={["#05070d"]} />
          <fog attach="fog" args={["#05070d", 14, 140]} />

          <ambientLight intensity={0.3} />
          <directionalLight position={[6, 10, 4]} intensity={1.1} color="#cdd6ff" />

          <Rig />
          <Atmosphere />

          <CityScene />
          <PlaceholderZones />
          <CurrentScene />

          <Effects />
        </Canvas>
      </div>
      <ScrollDebug />
    </>
  );
}
