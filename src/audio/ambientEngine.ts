/**
 * Ambient audio engine — a synthesized "night / electrical" sound bed for the dive
 * (spec §3.4 / §7, upgraded per the 100X briefing §10). Pure Web Audio, ZERO asset
 * files: a continuous low drone for continuity, six characterful per-dimension
 * "tint" beds crossfaded as the camera descends, slow LFOs (0.05–0.2Hz) so the
 * beds breathe instead of droning, a generated-IR convolver send for space, a
 * velocity-driven bandpass-noise wind bus (sound confirms motion), and one-shot
 * boundary stingers (filtered-noise whoosh + relay click) welded to the Rig's
 * edge-detected crossings.
 *
 * Gated behind the HUD sound toggle — that click is the user gesture the autoplay
 * policy requires, so the AudioContext is created + resumed from inside it via
 * ensureStarted(). Module singleton (one context per page). SSR-safe: nothing
 * touches `window`/`document` until ensureStarted() runs in the browser.
 *
 * Public API (Hud + AmbientAudio depend on these — keep signatures stable):
 *   ensureStarted() · setEnabled(on) · setDimension(i)
 *   setWind(level 0..1, per-rAF safe) · playBoundaryStinger(velocity, gentle?)
 *
 * MIX DISCIPLINE: ambient bed, not music. Everything mixes into `bus`, runs
 * through a DynamicsCompressor (stinger peaks can never clip), then `master`
 * (enable/mute ramp + hidden-tab duck to 10% — iOS also suspends the context in
 * background, so visibilitychange both ducks and resume()s). Voice gains sit at
 * 0.8–0.9 (±~1dB of each other) and source levels are chosen to perceptually
 * match — no bed strays more than ±3dB from the master target.
 *
 * TONAL MAP (the loop seam is a key decision): the through-line drone holds 55Hz.
 * CITY hums at 55/110 (same root); CURRENT is a brighter rising drone rooted at
 * 110 — one octave UP from the City — so when dimension 6 wraps back to 1 the
 * existing 2.4s crossfade resolves down the octave instead of changing key. The
 * hand-off is the audio mirror of "the current becomes the city's light".
 */

import { clamp } from "@/src/lib/math";

let ctx: AudioContext | null = null;
let master: GainNode | null = null; // enable/mute + hidden-duck stage (post-compressor)
let bus: GainNode | null = null; // pre-compressor mix point — every source lands here
let tints: GainNode[] = []; // per-dimension crossfade stage (setDimension automates these)
let windGain: GainNode | null = null; // velocity wind level (driven per-rAF via setWind)
let windFilter: BiquadFilterNode | null = null; // wind brightness follows speed too
let noiseBuf: AudioBuffer | null = null; // shared 2s white noise — looped beds AND one-shots
let started = false;
let enabled = false;
let curDim = 0;

const MASTER_ON = 0.16;
const HIDDEN_DUCK = 0.1; // fraction of MASTER_ON while document.hidden
const WIND_MAX = 0.2; // wind-bus gain ceiling — present under fast flicks, never dominant

// Seeded PRNG (project rule: seeded randomness; also gives every visit the same
// sonic character — ping pitches, crackle texture, IR grain are deterministic).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xe1ec0);

/**
 * Build the audio graph and resume the context. MUST be called from a user
 * gesture (the sound-toggle click, or AmbientAudio's persisted-preference
 * pointerdown/keydown re-arm) the first time, per the autoplay policy.
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
  noiseBuf = makeNoiseBuffer(c, 2);

  // Master chain: bus (mix) → compressor → master (enable/duck) → out. The
  // compressor is a safety ceiling, not an effect — at bed levels it idles and
  // only catches stinger peaks, so the mix can never clip the destination.
  bus = c.createGain();
  bus.gain.value = 1;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 14;
  comp.ratio.value = 5;
  comp.attack.value = 0.008;
  comp.release.value = 0.3;
  master = c.createGain();
  master.gain.value = 0;
  bus.connect(comp);
  comp.connect(master);
  master.connect(c.destination);

  // SPACE — a global send into a convolver with a procedurally generated IR
  // (1.8s exponential-decay stereo noise). Synth IR, no asset files; the wet
  // return joins BEFORE the compressor so reverb tails are protected too.
  const convolver = c.createConvolver();
  convolver.buffer = makeImpulse(c, 1.8);
  const send = c.createGain();
  send.gain.value = 0.3;
  const wet = c.createGain();
  wet.gain.value = 0.5;
  bus.connect(send);
  send.connect(convolver);
  convolver.connect(wet);
  wet.connect(comp);

  // Continuous low drone (two slightly-detuned sines at the 55Hz root) — the
  // through-line under every dimension. City's 55.5 beats slowly against it.
  const droneBus = c.createGain();
  droneBus.gain.value = 0.4;
  droneBus.connect(bus);
  for (const f of [55, 55.3]) tone(c, "sine", f, 0.3, droneBus);

  // Per-dimension tint beds — only the active one is audible; crossfaded by
  // setDimension. Each is built in buildTintVoice with its own LFO breathing.
  tints = [0, 1, 2, 3, 4, 5].map((i) => buildTintVoice(c, i, bus as GainNode));

  // Faint filtered-noise texture (electrical air) — always on, under everything.
  {
    const g = c.createGain();
    g.gain.value = 0.04;
    noiseLoop(c, filt(c, "bandpass", 780, 0.7)).connect(g);
    g.connect(bus);
  }

  // VELOCITY WIND — a bandpass-noise bus whose gain (and brightness) follows
  // |scroll velocity|. The lerp lives in AmbientAudio's rAF bridge; setWind only
  // writes the already-smoothed level.
  windFilter = filt(c, "bandpass", 850, 0.9);
  windGain = c.createGain();
  windGain.gain.value = 0;
  noiseLoop(c, windFilter);
  windFilter.connect(windGain);
  windGain.connect(bus);

  // Sparse-event scheduler (Frame pings, Wiring crackle). A 300ms probability
  // tick, not per-frame work; ticks no-op while muted or hidden. Events route
  // INTO their dimension's tint gain so the 2.4s crossfade fades them with the
  // bed automatically — no separate gating logic.
  window.setInterval(schedulerTick, 300);

  // Hidden-tab discipline: duck the master to 10% (drones in a background tab
  // are hostile) and resume() on return — iOS suspends the context in background
  // and will NOT resume it without an explicit call.
  document.addEventListener("visibilitychange", onVisibility);

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
      hidden: document.hidden,
      wind: windGain?.gain.value ?? 0,
    });
  }
}

/** Ramp the master gain up (enabled) or down (muted). Smooth, exponential-ish. */
export function setEnabled(on: boolean): void {
  enabled = on;
  if (!ctx || !master) return;
  if (on) void ctx.resume();
  applyMasterGain(on ? 1.1 : 0.5);
}

/** Crossfade the per-dimension tint beds to dimension `i` (slow + dreamy). */
export function setDimension(i: number): void {
  curDim = i;
  if (!ctx || tints.length === 0) return;
  const t = ctx.currentTime;
  tints.forEach((g, k) => {
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(k === i ? 1 : 0, t, 2.4);
  });
}

/**
 * Velocity wind level, 0..1 (caller lerps per-rAF; this just writes). The
 * power curve keeps slow scrolls near-silent; brightness rises with speed so a
 * flick reads as rushing air, not a volume knob. Safe to call every frame —
 * cancel+setTargetAtTime keeps the automation timeline from growing unbounded.
 */
export function setWind(level: number): void {
  if (!ctx || !windGain || !windFilter) return;
  const l = clamp(level, 0, 1);
  const t = ctx.currentTime;
  windGain.gain.cancelScheduledValues(t);
  windGain.gain.setTargetAtTime(Math.pow(l, 1.4) * WIND_MAX, t, 0.06);
  windFilter.frequency.cancelScheduledValues(t);
  windFilter.frequency.setTargetAtTime(550 + l * 1300, t, 0.12);
}

/**
 * Boundary one-shot: a ~300ms filtered-noise whoosh (falling lowpass sweep)
 * plus a relay click + soft armature thunk ~50ms in — fired by AmbientAudio
 * from the same store `lastBoundary` event as the visual flash (single source
 * of truth). Output scales with the event's |velocity| via a soft knee so any
 * Lenis magnitude maps sanely. `gentle` (reduced-motion) halves the energy and
 * dulls the sweep — audio stays, the startle goes. Fresh nodes per play; each
 * source's onended detaches its chain so nothing leaks across a long session.
 */
export function playBoundaryStinger(velocity: number, gentle = false): void {
  const c = ctx;
  if (!c || !started || !enabled || !bus || !noiseBuf) return;
  const out = bus;
  const t = c.currentTime;
  const punch = 1 - Math.exp(-Math.abs(velocity) / 28); // soft knee → 0..1
  const amp = (0.07 + 0.18 * punch) * (gentle ? 0.4 : 1);

  // Whoosh — noise through a lowpass sweeping ~2300→170Hz over 300ms.
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const lp = filt(c, "lowpass", gentle ? 1100 : 2300, 1.1);
  lp.frequency.setValueAtTime(gentle ? 1100 : 2300, t);
  lp.frequency.exponentialRampToValueAtTime(170, t + 0.3);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.025);
  g.gain.setTargetAtTime(0, t + 0.06, 0.09);
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  src.start(t, rng() * 1.2, 0.5);
  src.onended = () => g.disconnect();

  // Relay click — a tiny square blip at the threshold moment (the "contact").
  const t1 = t + 0.05;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = 2350;
  const og = c.createGain();
  og.gain.setValueAtTime(0, t1);
  og.gain.linearRampToValueAtTime(amp * (gentle ? 0.25 : 0.5), t1 + 0.003);
  og.gain.setTargetAtTime(0, t1 + 0.008, 0.012);
  osc.connect(og);
  og.connect(out);
  osc.start(t1);
  osc.stop(t1 + 0.15);
  osc.onended = () => og.disconnect();

  // Soft thunk — a 165→55Hz sine drop gives the click a body (breaker armature).
  const th = c.createOscillator();
  th.type = "sine";
  th.frequency.setValueAtTime(165, t1);
  th.frequency.exponentialRampToValueAtTime(55, t1 + 0.09);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0, t1);
  tg.gain.linearRampToValueAtTime(amp * 0.45, t1 + 0.006);
  tg.gain.setTargetAtTime(0, t1 + 0.02, 0.05);
  th.connect(tg);
  tg.connect(out);
  th.start(t1);
  th.stop(t1 + 0.35);
  th.onended = () => tg.disconnect();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Master target collapses three states: muted=0, hidden=10%, else MASTER_ON. */
function applyMasterGain(tau: number): void {
  if (!ctx || !master) return;
  const target = !enabled ? 0 : document.hidden ? MASTER_ON * HIDDEN_DUCK : MASTER_ON;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(target, t, tau);
}

function onVisibility(): void {
  if (!ctx || !master) return;
  // iOS suspends the context when the tab backgrounds; resume must be explicit.
  if (!document.hidden) void ctx.resume();
  applyMasterGain(document.hidden ? 0.25 : 0.6);
}

/**
 * One per-dimension bed. Two gain stages on purpose: `vg` breathes (LFO around a
 * fixed base — never touched by automation) and feeds `tg`, the crossfade stage
 * setDimension automates 0↔1. Putting the LFO on the crossfade gain instead
 * would fight the setTargetAtTime curve and push a "silent" bed audible.
 */
function buildTintVoice(c: AudioContext, i: number, out: GainNode): GainNode {
  const tg = c.createGain();
  tg.gain.value = i === curDim ? 1 : 0;
  tg.connect(out);
  const vg = c.createGain();
  vg.connect(tg);

  switch (i) {
    case 0: {
      // CITY — deep hum (55/110, the drone's root) + faint lowpassed traffic
      // noise whose cutoff swells slowly (passing cars, blocks away).
      vg.gain.value = 0.9;
      lfo(c, 0.06, 0.16, vg.gain);
      tone(c, "sine", 55.5, 0.2, vg); // beats slowly against the 55/55.3 drone
      tone(c, "sine", 110.2, 0.16, vg);
      const traffic = filt(c, "lowpass", 230, 0.4);
      lfo(c, 0.08, 80, traffic.frequency);
      const tgain = c.createGain();
      tgain.gain.value = 0.12;
      noiseLoop(c, traffic).connect(tgain);
      tgain.connect(vg);
      break;
    }
    case 1: {
      // BUILDING — airy wind noise (bandpass with slow gusting cutoff) over a
      // hollow lowpassed 82Hz tone (the unfinished concrete shell resonating).
      vg.gain.value = 0.85;
      lfo(c, 0.09, 0.18, vg.gain);
      const wind = filt(c, "bandpass", 460, 0.7);
      lfo(c, 0.13, 200, wind.frequency);
      const wgain = c.createGain();
      wgain.gain.value = 0.17;
      noiseLoop(c, wind).connect(wgain);
      wgain.connect(vg);
      const hollow = filt(c, "lowpass", 240, 0.8);
      tone(c, "sine", 82, 0.2, hollow);
      hollow.connect(vg);
      break;
    }
    case 2: {
      // FRAME — metallic: a dark triangle base + continuous faint high-Q
      // bandpass shimmer (the filter IS the steel); sparse struck-metal pings
      // arrive from the scheduler, routed into this same tint gain.
      vg.gain.value = 0.8;
      lfo(c, 0.12, 0.14, vg.gain);
      const base = filt(c, "lowpass", 850, 0.7);
      tone(c, "triangle", 146.8, 0.15, base);
      base.connect(vg);
      const n = noiseLoop(c, null);
      for (const [f, q, lvl] of [
        [1244.5, 26, 0.022],
        [2093, 30, 0.012],
      ] as const) {
        const bp = filt(c, "bandpass", f, q);
        const g = c.createGain();
        g.gain.value = lvl;
        n.connect(bp);
        bp.connect(g);
        g.connect(vg);
      }
      break;
    }
    case 3: {
      // ROOM — warm mellow chord (G2 add9: 98 / 123.47 / 146.83 / 220) through
      // a gentle lowpass whose cutoff tides at 0.07Hz. The softest bed.
      vg.gain.value = 0.85;
      lfo(c, 0.05, 0.15, vg.gain);
      const mellow = filt(c, "lowpass", 640, 0.5);
      lfo(c, 0.07, 120, mellow.frequency);
      tone(c, "sine", 98, 0.16, mellow);
      tone(c, "sine", 123.47, 0.1, mellow);
      tone(c, "sine", 146.83, 0.09, mellow);
      tone(c, "sine", 220, 0.045, mellow);
      mellow.connect(vg);
      break;
    }
    case 4: {
      // WIRING — a 100Hz mains hum (lowpassed saw keeps the 200/300 harmonics)
      // under faint close crackle air; discrete crackle bursts come from the
      // scheduler. Fastest breathing LFO — electrical instability.
      vg.gain.value = 0.85;
      lfo(c, 0.16, 0.12, vg.gain);
      const hum = filt(c, "lowpass", 330, 1.0);
      tone(c, "sawtooth", 100, 0.13, hum);
      hum.connect(vg);
      const air = filt(c, "highpass", 1700, 0.7);
      const agan = c.createGain();
      agan.gain.value = 0.012;
      noiseLoop(c, air).connect(agan);
      agan.connect(vg);
      break;
    }
    default: {
      // CURRENT — brighter rising drone rooted at 110 (one octave above the
      // City: the wrap crossfade resolves down the octave, in key). "Rising"
      // is a slow ±420Hz cutoff swell, not pitch drift — cyclic, loop-safe.
      vg.gain.value = 0.9;
      lfo(c, 0.07, 0.16, vg.gain);
      const bright = filt(c, "lowpass", 800, 0.8);
      lfo(c, 0.05, 420, bright.frequency);
      tone(c, "sawtooth", 110, 0.11, bright);
      tone(c, "sawtooth", 110.8, 0.09, bright);
      bright.connect(vg);
      tone(c, "sine", 220.4, 0.05, vg);
      break;
    }
  }
  return tg;
}

// --- sparse-event scheduler --------------------------------------------------

// Inharmonic "struck steel" partials for the Frame pings.
const PING_FREQS = [932.3, 1244.5, 1661.2, 2489] as const;

function schedulerTick(): void {
  const c = ctx;
  if (!c || !enabled || document.hidden) return;
  // AudioParam.value reads the current automated value — skip while inaudible
  // so muted/faded dimensions create zero garbage.
  if (tints[2] && tints[2].gain.value > 0.05 && rng() < 0.16) playPing(c);
  if (tints[4] && tints[4].gain.value > 0.05 && rng() < 0.34) playCrackle(c);
}

/** Sparse metallic ping: a noise burst rung through a Q≈28 bandpass. */
function playPing(c: AudioContext): void {
  if (!noiseBuf) return;
  const t = c.currentTime;
  const f = PING_FREQS[(rng() * PING_FREQS.length) | 0] * (0.985 + rng() * 0.03);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bp = filt(c, "bandpass", f, 28);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.008);
  g.gain.setTargetAtTime(0, t + 0.02, 0.18);
  src.connect(bp);
  bp.connect(g);
  g.connect(tints[2]);
  src.start(t, rng() * 1.5, 0.85);
  src.onended = () => g.disconnect();
}

/** Close electrical crackle: a 120ms high-frequency noise snap. */
function playCrackle(c: AudioContext): void {
  if (!noiseBuf) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const hp = filt(c, "highpass", 1800, 0.7);
  const bp = filt(c, "bandpass", 3000, 2.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.022 + rng() * 0.03, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.01, 0.018);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(tints[4]);
  src.start(t, rng() * 1.8, 0.12);
  src.onended = () => g.disconnect();
}

// --- node helpers --------------------------------------------------------------

/** 2s of seeded white noise — one shared buffer for every loop and one-shot. */
function makeNoiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (rng() * 2 - 1) * 0.5;
  return buf;
}

/**
 * Procedural impulse response: stereo exponential-decay noise (~-37dB at the
 * tail) with a 10ms fade-in so the wet return doesn't comb against the dry.
 */
function makeImpulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const fadeIn = Math.floor(c.sampleRate * 0.01);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (rng() * 2 - 1) * Math.exp((-4.2 * i) / len) * Math.min(1, i / fadeIn);
    }
  }
  return buf;
}

/**
 * Slow modulation: sine osc → depth gain → AudioParam (additive around the
 * param's base value). Rates 0.05–0.2Hz; every voice gets a different rate so
 * the beds never breathe in lockstep.
 */
function lfo(c: AudioContext, rate: number, depth: number, param: AudioParam): void {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = rate;
  const g = c.createGain();
  g.gain.value = depth;
  o.connect(g);
  g.connect(param);
  o.start();
}

/** Started oscillator at a fixed level into `dest`. */
function tone(
  c: AudioContext,
  type: OscillatorType,
  freq: number,
  level: number,
  dest: AudioNode,
): void {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = level;
  o.connect(g);
  g.connect(dest);
  o.start();
}

/** Looping white-noise source, optionally pre-wired into `dest`. */
function noiseLoop(c: AudioContext, dest: AudioNode | null): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  if (dest) src.connect(dest);
  src.start();
  return src;
}

function filt(c: AudioContext, type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
