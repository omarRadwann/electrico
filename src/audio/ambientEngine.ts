/**
 * Ambient audio engine — a synthesized "night / electrical" sound bed for the dive
 * (spec §3.4 / §7). Pure Web Audio, no asset files: a continuous low drone for
 * continuity, six per-dimension "tint" voices that crossfade as the camera
 * descends, and a faint filtered-noise texture (electrical air).
 *
 * Gated behind the HUD sound toggle — that click is the user gesture the autoplay
 * policy requires, so the AudioContext is created + resumed from inside it via
 * ensureStarted(). Module singleton (one context per page). SSR-safe: nothing
 * touches `window` until ensureStarted() runs in the browser on a real click.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let tints: GainNode[] = [];
let started = false;
let enabled = false;
let curDim = 0;

// Per-dimension tint: frequency (Hz) + waveform, low and ambient with a touch of
// character each — City warm hum, Building low drone, Frame metallic, Room warm
// pad, Wiring electric buzz, Current bright tone.
const FREQS = [110, 82, 146.8, 98, 165, 220];
const WAVES: OscillatorType[] = ["sine", "sine", "triangle", "sine", "sawtooth", "sine"];
const MASTER_ON = 0.16;

/**
 * Build the audio graph and resume the context. MUST be called from a user
 * gesture (the sound-toggle click) the first time, per the autoplay policy.
 * Idempotent — later calls just resume.
 */
export function ensureStarted(): void {
  if (started) {
    void ctx?.resume();
    return;
  }
  if (typeof window === "undefined") return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;

  const c = new AC();
  ctx = c;
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  // Continuous low drone (two slightly-detuned sines) — the through-line.
  const droneBus = c.createGain();
  droneBus.gain.value = 0.5;
  droneBus.connect(master);
  for (const f of [55, 55.3]) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.32;
    o.connect(g);
    g.connect(droneBus);
    o.start();
  }

  // Per-dimension tint voices — only the active one is audible; crossfaded.
  tints = FREQS.map((f, i) => {
    const o = c.createOscillator();
    o.type = WAVES[i];
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = WAVES[i] === "sawtooth" ? 520 : 1100;
    lp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = i === curDim ? 1 : 0;
    o.connect(lp);
    lp.connect(g);
    g.connect(master as GainNode);
    o.start();
    return g;
  });

  // Faint filtered-noise texture (electrical air).
  const noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nbp = c.createBiquadFilter();
  nbp.type = "bandpass";
  nbp.frequency.value = 780;
  nbp.Q.value = 0.7;
  const ng = c.createGain();
  ng.gain.value = 0.05;
  noise.connect(nbp);
  nbp.connect(ng);
  ng.connect(master);
  noise.start();

  started = true;
  void c.resume();
  setEnabled(enabled);
  setDimension(curDim);

  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __audio?: () => unknown }).__audio = () => ({
      started,
      enabled,
      state: ctx?.state ?? null,
      dim: curDim,
    });
  }
}

/** Ramp the master gain up (enabled) or down (muted). Smooth, exponential-ish. */
export function setEnabled(on: boolean): void {
  enabled = on;
  if (!ctx || !master) return;
  if (on) void ctx.resume();
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(on ? MASTER_ON : 0, t, on ? 1.1 : 0.5);
}

/** Crossfade the per-dimension tint voices to dimension `i` (slow + dreamy). */
export function setDimension(i: number): void {
  curDim = i;
  if (!ctx || tints.length === 0) return;
  const t = ctx.currentTime;
  tints.forEach((g, k) => {
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(k === i ? 1 : 0, t, 2.4);
  });
}
