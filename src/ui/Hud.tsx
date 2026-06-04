"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useExperience } from "@/src/store/useExperience";
import { ZONES, ZONE_PROGRESS } from "@/src/experience/cameraPath";
import { ensureStarted } from "@/src/audio/ambientEngine";

/**
 * Diegetic HUD — "descent telemetry". Reads like the dive's own instrumentation,
 * not a web nav (spec §3.3: depth indicator + layer titles, no top nav bar).
 * DOM overlay above the canvas; pointer-events:none except the sound toggle.
 * The per-frame depth marker is driven by a self-contained rAF reading the store
 * (no React re-render per frame); the low-frequency dimension drives the rest.
 */

function Wordmark() {
  return (
    <div className="hud-wordmark" aria-hidden="true">
      <span className="hud-dot" />
      ELECTRICO
    </div>
  );
}

function SoundToggle() {
  const audioOn = useExperience((s) => s.audioOn);
  const setAudioOn = useExperience((s) => s.setAudioOn);
  return (
    <button
      type="button"
      className={`hud-sound${audioOn ? " is-on" : ""}`}
      onClick={() => {
        // This click is the autoplay gesture — create/resume the AudioContext
        // here (in the gesture call stack), then flip the store; <AmbientAudio/>
        // ramps the gain in response.
        ensureStarted();
        setAudioOn(!audioOn);
      }}
      aria-pressed={audioOn}
    >
      <span className="hud-eq" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {audioOn ? "Sound on" : "Sound — tap to enable"}
    </button>
  );
}

function DepthGauge() {
  const markerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const dimension = useExperience((s) => s.dimension);
  const color = ZONES[dimension]?.color ?? "#e8a23d";

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = useExperience.getState().progress;
      const pct = p * 100;
      if (markerRef.current) markerRef.current.style.top = `${pct}%`;
      if (fillRef.current) fillRef.current.style.height = `${pct}%`;
      if (pctRef.current) pctRef.current.textContent = String(Math.round(pct)).padStart(2, "0");
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hud-gauge" aria-hidden="true">
      <span className="hud-gauge-cap">DESCENT</span>
      <div className="hud-gauge-track">
        <div className="hud-gauge-fill" ref={fillRef} />
        {ZONES.map((z, i) => (
          <div
            key={z.index}
            className={`hud-gauge-tick${i === dimension ? " is-active" : ""}`}
            style={{ top: `${ZONE_PROGRESS[i] * 100}%`, ["--tc"]: z.color } as CSSProperties}
          >
            <span className="hud-gauge-tick-num">{String(i + 1).padStart(2, "0")}</span>
          </div>
        ))}
        <div className="hud-gauge-marker" ref={markerRef} style={{ ["--mc"]: color } as CSSProperties} />
      </div>
      <span className="hud-gauge-pct">
        <span ref={pctRef}>00</span>
        <small>%</small>
      </span>
    </div>
  );
}

function LayerTitle() {
  const dimension = useExperience((s) => s.dimension);
  const zone = ZONES[dimension];
  if (!zone) return null;
  return (
    <div className="hud-layer" key={dimension} style={{ ["--ac"]: zone.color } as CSSProperties}>
      <span className="hud-layer-num">{String(dimension + 1).padStart(2, "0")}</span>
      <span className="hud-layer-body">
        <span className="hud-layer-name">{zone.name}</span>
        <span className="hud-layer-rule" />
      </span>
    </div>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <Wordmark />
      <SoundToggle />
      <DepthGauge />
      <LayerTitle />
    </div>
  );
}
