/**
 * Cookieless event channel (briefing §13 — the site currently flies blind).
 *
 * `track` forwards to `window.plausible` when the Plausible snippet is present
 * (it can be added to layout.tsx later with zero changes here), logs via
 * console.debug in dev so the funnel is visible while building, and is a
 * silent no-op otherwise — analytics must never break or slow the experience
 * on static export.
 *
 * DISCIPLINE: call sites are LOW-frequency only (funnel beats, CTA clicks).
 * Never call from useFrame / rAF loops — high-frequency state stays inside
 * the store/refs per the per-frame rules.
 */
type EventProps = Record<string, string | number>;

type PlausibleFn = (event: string, options?: { props?: EventProps }) => void;

export function track(event: string, props?: EventProps): void {
  if (typeof window === "undefined") return;
  const plausible = (window as Window & { plausible?: PlausibleFn }).plausible;
  if (typeof plausible === "function") {
    plausible(event, props ? { props } : undefined);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[analytics] ${event}`, props ?? {});
  }
}
