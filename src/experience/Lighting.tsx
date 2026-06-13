"use client";

import { Environment, Lightformer, useProgress } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "./quality";
import { asset } from "@/src/lib/asset";

/**
 * World lighting: a low cool directional key + a night HDRI for image-based
 * lighting, PLUS shaped Lightformer area lights that give the steel, glass and
 * metal real specular highlights — the difference between flat surfaces and
 * surfaces that gleam (the Step-4 normal maps catch these). envIntensity follows
 * the quality tier (kept modest to protect the deep-night mood).
 */
export function Lighting() {
  const tier = TIERS[useExperience((s) => s.quality)];
  const envIntensity = tier.envIntensity;
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const warmup = useRef(0);

  // The freeze is driven by LOAD COMPLETION, not frames-since-mount: scene GLBs
  // arrive via Suspense long after this component mounts, so a mount-counted
  // freeze locks an EMPTY depth map on real networks (full-tier visitors would
  // get zero directional shadows). drei's useProgress is the global loader
  // state — low-frequency, safe to subscribe.
  const { active, progress } = useProgress();
  const loaded = !active && progress === 100;

  // RE-ARM whenever loading resumes (a late GLB, a tier-driven texture swap):
  // unfreeze + restart the warmup so the new geometry lands in the depth map.
  useEffect(() => {
    if (loaded) return;
    warmup.current = 0;
    const d = dirRef.current;
    if (d && !d.shadow.autoUpdate) d.shadow.autoUpdate = true;
  }, [loaded]);

  // PERF: the moon-key shadow covers the whole (static) dive corridor. Once all
  // assets have landed, render the depth map for a short warmup (a few frames so
  // every Suspense-mounted scene is committed to the GPU), then FREEZE it
  // (autoUpdate=false) — nothing in the world moves, so a per-frame
  // full-corridor shadow re-render is pure waste. Full tier only (castShadow
  // follows heavyProps below). If nothing ever loads, the shadow simply stays
  // live — the safe failure direction.
  useFrame(() => {
    const d = dirRef.current;
    if (!d || !tier.heavyProps || !loaded) return;
    if (warmup.current < 12) warmup.current += 1;
    else if (d.shadow.autoUpdate) d.shadow.autoUpdate = false;
  });

  return (
    <>
      {/* A whisper of cool ambient — just enough to keep the deepest shadows from
          pure black. The old 0.3 was a flat omnidirectional black-lifter (the milky
          half + the flat-lighting cause). */}
      <ambientLight intensity={0.06} color="#1a2233" />
      {/* The cool MOON KEY — a deliberate directional that MODELS mass (lit side /
          dark side) and casts the dive's primary shadow on the full tier. The
          explicit ortho frustum is mandatory: the default ±5 would clip the whole
          dive to nothing. */}
      <directionalLight
        ref={dirRef}
        position={[10, 18, 6]}
        intensity={1.6}
        color="#9ec3ff"
        castShadow={tier.heavyProps}
        shadow-mapSize={[tier.shadowMapSize, tier.shadowMapSize]}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0006}
      />
      <Environment
        files={asset("/hdri/dikhololo_night_1k.hdr")}
        environmentIntensity={envIntensity}
        background={false}
      >
        {/* Cool key overhead, warm low fill, a tall side rim — shaped specular the
            glossy steel / metal / glass reflect as moving highlights. */}
        <Lightformer form="rect" intensity={1.6} color="#aab8ff" position={[0, 6, -8]} scale={[13, 5, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#ffcf9a" position={[3, -5, 4]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#bfe0ff" position={[-7, 1, 0]} scale={[1, 7, 1]} />
      </Environment>
    </>
  );
}
