"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useExperience } from "@/src/store/useExperience";
import { TIERS } from "./quality";

/**
 * World lighting: a low cool directional key + a night HDRI for image-based
 * lighting, PLUS shaped Lightformer area lights that give the steel, glass and
 * metal real specular highlights — the difference between flat surfaces and
 * surfaces that gleam (the Step-4 normal maps catch these). envIntensity follows
 * the quality tier (kept modest to protect the deep-night mood).
 */
export function Lighting() {
  const envIntensity = TIERS[useExperience((s) => s.quality)].envIntensity;

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} color="#cdd6ff" />
      <Environment
        files="/hdri/dikhololo_night_1k.hdr"
        environmentIntensity={envIntensity}
        background={false}
      >
        {/* Cool key overhead, warm low fill, a tall side rim — shaped specular the
            glossy steel / metal / glass reflect as moving highlights. */}
        <Lightformer form="rect" intensity={3} color="#aab8ff" position={[0, 6, -8]} scale={[13, 5, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffcf9a" position={[3, -5, 4]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#bfe0ff" position={[-7, 1, 0]} scale={[1, 7, 1]} />
      </Environment>
    </>
  );
}
