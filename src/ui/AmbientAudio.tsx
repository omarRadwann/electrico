"use client";

import { useEffect } from "react";
import { useExperience } from "@/src/store/useExperience";
import { setDimension, setEnabled } from "@/src/audio/ambientEngine";

/**
 * Drives the ambient audio engine from the store. The AudioContext is created +
 * resumed inside the sound-toggle's click (the autoplay gesture, see Hud); this
 * component only keeps the engine's enabled state and active dimension in sync —
 * both calls no-op until the engine has been started, so they're safe pre-gesture.
 */
export function AmbientAudio() {
  const audioOn = useExperience((s) => s.audioOn);
  const dimension = useExperience((s) => s.dimension);

  useEffect(() => {
    setEnabled(audioOn);
  }, [audioOn]);

  useEffect(() => {
    setDimension(dimension);
  }, [dimension]);

  return null;
}
