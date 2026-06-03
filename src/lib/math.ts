/**
 * Motion math helpers (spec §10 — "no magic numbers in motion: centralize
 * easing/remap/clamp"). Pure, side-effect-free, shared across rig + scenes.
 */

/** Clamp `v` into the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Linear interpolation from `a` to `b` by `t` (t is not clamped). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Remap `v` from the range [inMin, inMax] to [outMin, outMax].
 * Used to slice the global 0..1 scroll progress into per-dimension sub-ranges.
 */
export function remap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}

/** Smooth Hermite interpolation (the GLSL `smoothstep`) between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
