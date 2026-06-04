"use client";

import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { createRenderer } from "@/src/three/createRenderer";
import { useSmoothScroll } from "@/src/hooks/useSmoothScroll";
import { ScrollDebug } from "@/src/ui/ScrollDebug";
import { Rig } from "./Rig";
import { Atmosphere } from "./Atmosphere";
import { AmbientDebris } from "./AmbientDebris";
import { CityScene } from "./scenes/CityScene";
import { BuildingScene } from "./scenes/BuildingScene";
import { FrameScene } from "./scenes/FrameScene";
import { RoomScene } from "./scenes/RoomScene";
import { WiringScene } from "./scenes/WiringScene";
import { CurrentScene } from "./scenes/CurrentScene";
import { Effects } from "./Effects";

/**
 * The 3D experience island. One <Canvas>, one camera (the Rig), one continuous
 * night world behind the page's real HTML content. Lenis owns DOM smooth-scroll
 * (no drei <ScrollControls>); the Rig reads store `progress` in useFrame.
 *
 * All six dimensions now have real procedural scenes laid out along the dive
 * path. Atmosphere shifts fog + background per layer; Effects adds the bloom
 * that makes the glow read. (M2's render-target portals/transitions are the next
 * refinement on top of this continuous fly-through.)
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
          {/* Low-intensity night IBL: adds specular sheen/reflections to steel,
              copper and glass without lifting the dark mood. background:false so
              Atmosphere keeps the backdrop. (Self-host the HDRI at M8.) */}
          <Environment preset="night" environmentIntensity={0.12} background={false} />

          <Rig />
          <Atmosphere />

          {/* Dimensions 1 → 6 along the dive path. */}
          <CityScene />
          <BuildingScene />
          <FrameScene />
          <RoomScene />
          <WiringScene />
          <CurrentScene />

          <AmbientDebris />
          <Effects />
        </Canvas>
      </div>
      <ScrollDebug />
    </>
  );
}
