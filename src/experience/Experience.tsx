"use client";

import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
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
import { CityDepth } from "./scenes/CityDepth";
import { BuildingScene } from "./scenes/BuildingScene";
import { BuildingSite } from "./scenes/BuildingSite";
import { FrameScene } from "./scenes/FrameScene";
import { FrameSurge } from "./scenes/FrameSurge";
import { RoomScene } from "./scenes/RoomScene";
import { RoomProps } from "./scenes/RoomProps";
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
/**
 * One-shot warm-up: after assets load, force every object (incl. the
 * progress-gated Frame/Wiring groups, which mount invisible) visible, compile all
 * shader programs, render once to upload geometry/instance buffers, then restore
 * visibility. Runs while the Loader still covers the screen, so the camera never
 * hits a first-use compile stall mid-dive. Kept inside <Suspense> so it waits for
 * the GLBs; gated on loadProgress so it fires after the LoadingManager finishes.
 */
function Precompile() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    if (useExperience.getState().loadProgress < 1) return;
    done.current = true;
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    gl.compile(scene, camera);
    gl.render(scene, camera); // forces program LINK + geometry/instance buffer upload
    for (const o of hidden) o.visible = false;
  });
  return null;
}

export function Experience() {
  useSmoothScroll();

  // CONTEXT-LOSS RECOVERY: a GPU reset (driver update, OS sleep, VRAM pressure)
  // would otherwise freeze the canvas on its last frame forever while the HTML
  // keeps scrolling behind it. Bumping this key remounts the <Canvas>, which
  // re-runs the renderer factory + onCreated and rebuilds the whole scene graph
  // (assets come back from the loader caches, so recovery is fast).
  const [glKey, setGlKey] = useState(0);

  return (
    <>
      <div className="experience-root" aria-hidden="true">
        <Canvas
          key={glKey}
          gl={createRenderer}
          // `shadows` is MANDATORY, not decorative: R3F's configure() runs
          // `gl.shadowMap.enabled = !!shadows` AFTER the createRenderer factory
          // (verified in the fiber 9.6 dist) — without this prop every castShadow
          // in the site is silently dead. Boolean `true` also selects
          // PCFSoftShadowMap inside configure(), matching the factory.
          shadows
          dpr={[1, 2]}
          // far=300: the world ends at z≈-250 (Current at -216 + margin). The old
          // 2000 threw away depth precision that N8AO and DOF read every frame.
          camera={{ fov: 55, near: 0.1, far: 300, position: [0, 0, 8] }}
          onCreated={({ gl }) => {
            // Runs AFTER R3F configure(), which overrides the factory's tone
            // mapping to ACESFilmic (no `flat` prop) — re-assert the signed-off
            // AgX grade here. See the matching note in createRenderer.ts.
            gl.toneMapping = THREE.AgXToneMapping;
            gl.toneMappingExposure = 0.8;
            // configure() already set PCFSoft (boolean `shadows`); re-assert so a
            // future Canvas prop change can't silently regress the shadow type.
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            // Context-loss handshake: preventDefault on `lost` tells the browser
            // we want a restore; `restored` remounts the Canvas via the key bump.
            // Listeners die with the discarded canvas element on remount.
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
            canvas.addEventListener("webglcontextrestored", () => setGlKey((k) => k + 1));
          }}
        >
          {/* Single continuous "night" world; Atmosphere shifts these per layer. */}
          <color attach="background" args={["#05070d"]} />
          <fog attach="fog" args={["#05070d", 40, 150]} />

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
            <CityDepth />
            <CityLife />
            <CityInfra />
            <BuildingScene />
            <BuildingSite />
            <FrameScene />
            <FrameSurge />
            <RoomScene />
            <RoomProps />
            <WiringScene />
            <CurrentScene />
            {/* PRE-COMPILE EVERYTHING under the loader (fixes the multi-second
                "scene freezes then continues" hitch). The progress-gated scenes
                (Frame p∈[0.30,0.53], Wiring p∈[0.69,0.85]) mount visible=false, so
                ANGLE never compiled+linked their (heavy, onBeforeCompile) programs
                nor uploaded their instance buffers at load — that happened the
                first time the camera REVEALED them mid-scroll = a 4-8s GPU stall on
                the Iris Xe. drei <Preload all/> proved insufficient here, so we do
                it explicitly: once loadProgress hits 1, force EVERY object visible,
                gl.compile + one render (compiles programs AND uploads buffers),
                then restore. One-shot, runs while the loader still covers screen. */}
            <Precompile />
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
