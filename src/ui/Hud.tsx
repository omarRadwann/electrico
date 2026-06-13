"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useExperience, scrollToProgress } from "@/src/store/useExperience";
import { ZONES, ZONE_PROGRESS } from "@/src/experience/cameraPath";
import { ensureStarted } from "@/src/audio/ambientEngine";

/**
 * Diegetic HUD — "descent telemetry". Reads like the dive's own instrumentation,
 * not a web nav (spec §3.3: depth indicator + layer titles, no top nav bar).
 * DOM overlay above the canvas; pointer-events:none except the controls that
 * opt back in (sound toggle, gauge ticks). The per-frame depth marker is driven
 * by a self-contained rAF reading the store (no React re-render per frame);
 * the low-frequency dimension drives the rest.
 *
 * The depth-gauge ticks double as the site's only navigation (briefing §6.6):
 * click → scrollToProgress(ZONE_PROGRESS[i]) dives the camera to that parked
 * arrival, plus a 7th CONTACT affordance that summons the conversion terminal —
 * diegetic chapter nav, still no web navbar.
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
      {/* Device-neutral copy — "tap" lied on desktop. */}
      {audioOn ? "Sound on" : "Enable sound"}
    </button>
  );
}

function DepthGauge() {
  const markerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const dimension = useExperience((s) => s.dimension);
  const setTerminalOpen = useExperience((s) => s.setTerminalOpen);
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
    // A real <nav> now that the ticks are interactive — the decorative pieces
    // (fill, marker, readout) stay aria-hidden; the buttons carry the labels.
    <nav className="hud-gauge" aria-label="Dive navigation">
      <span className="hud-gauge-cap" aria-hidden="true">
        DESCENT
      </span>
      <div className="hud-gauge-track">
        <div className="hud-gauge-fill" ref={fillRef} aria-hidden="true" />
        {ZONES.map((z, i) => (
          <button
            key={z.index}
            type="button"
            className={`hud-gauge-tick${i === dimension ? " is-active" : ""}`}
            style={{ top: `${ZONE_PROGRESS[i] * 100}%`, ["--tc"]: z.color } as CSSProperties}
            onClick={() => scrollToProgress(ZONE_PROGRESS[i])}
            aria-label={`Dive to ${String(i + 1).padStart(2, "0")} — ${z.name}`}
            aria-current={i === dimension ? "true" : undefined}
          >
            <i className="hud-gauge-tick-bar" aria-hidden="true" />
            <span className="hud-gauge-tick-num" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
        {/* 7th stop — the conversion surface. A diamond, not a tick: a
            different class of destination than the six dimensions. */}
        <button
          type="button"
          className="hud-gauge-tick hud-gauge-tick--contact"
          style={{ top: "100%" }}
          onClick={() => setTerminalOpen(true)}
          aria-label="Open the contact terminal"
        >
          <i className="hud-gauge-tick-bar" aria-hidden="true" />
          <span className="hud-gauge-tick-num" aria-hidden="true">
            CONTACT
          </span>
        </button>
        <div
          className="hud-gauge-marker"
          ref={markerRef}
          aria-hidden="true"
          style={{ ["--mc"]: color } as CSSProperties}
        />
      </div>
      <span className="hud-gauge-pct" aria-hidden="true">
        <span ref={pctRef}>00</span>
        <small>%</small>
      </span>
    </nav>
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
