"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { createRenderer } from "@/src/three/createRenderer";
import { useSmoothScroll } from "@/src/hooks/useSmoothScroll";
import { Hud } from "@/src/ui/Hud";
import { Narrative } from "@/src/ui/Narrative";
import { AmbientAudio } from "@/src/ui/AmbientAudio";
import { Loader } from "@/src/ui/Loader";
import { LoopVeil } from "@/src/ui/LoopVeil";
import { Rig } from "./Rig";
import { QualityController } from "./quality";
import { Lighting } from "./Lighting";
import { Atmosphere } from "./Atmosphere";
import { AmbientDebris } from "./AmbientDebris";
import { CityScene } from "./scenes/CityScene";
import { CityLife } from "./scenes/CityLife";
import { CityInfra } from "./scenes/CityInfra";
import { BuildingScene } from "./scenes/BuildingScene";
import { BuildingSite } from "./scenes/BuildingSite";
import { FrameScene } from "./scenes/FrameScene";
import { FrameSurge } from "./scenes/FrameSurge";
import { RoomScene } from "./scenes/RoomScene";
import { WiringScene } from "./scenes/WiringScene";
import { CurrentScene } from "./scenes/CurrentScene";
import { Transitions } from "./Transitions";
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
          <fog attach="fog" args={["#05070d", 24, 185]} />

          {/* Directional key + night IBL + shaped Lightformer area lights — gives
              steel/glass/metal real specular highlights (the normal maps catch them). */}
          <Lighting />

          <Rig />
          <QualityController />
          <Atmosphere />

          {/* Dimensions 1 → 6 along the dive path. */}
          {/* Scenes load async assets (GLB furniture, tiling PBR surface maps) —
              one Suspense so they pop in cleanly once ready (the Loader covers it). */}
          <Suspense fallback={null}>
            <CityScene />
            <CityLife />
            <CityInfra />
            <BuildingScene />
            <BuildingSite />
            <FrameScene />
            <FrameSurge />
            <RoomScene />
            <WiringScene />
            <CurrentScene />
          </Suspense>

          <AmbientDebris />
          <Transitions />
          <Effects />
        </Canvas>
      </div>
      <LoopVeil />
      <Hud />
      <Narrative />
      <AmbientAudio />
      <Loader />
    </>
  );
}
