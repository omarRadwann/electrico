@AGENTS.md

# ELECTRICO — "The Dive" — working notes

Immersive, scroll-driven 3D website for an electrical / structural / smart-home
company. One camera, one authored path; scroll is the throttle; the visitor
"dives" through six nested dimensions joined by render-target transitions, and
dimension 6 loops back to 1. The full build spec ("The Dive") is the source of
truth and is held by the owner — this file is the continuity layer: decisions,
verified versions, and the milestone tracker.

## Brand decisions (confirmed with owner)
- **Name:** ELECTRICO, styled as an all-caps wordmark.
- **Locales:** English only, LTR. No RTL / i18n in scope.

## Flagged placeholders (not yet provided — using fallbacks, do not invent)
- `<<TAGLINE>>` — provisional line in use, derived from the brief's thesis:
  "We light the city, raise its structures, make it think, and keep its current
  alive." Replace when owner confirms.
- `<<BRAND_COLORS>>` — using the spec §6 placeholder palette (amber=power,
  steel=structure, teal=smart) on a `#05070d` night base. Flag for brand review.
- `<<FONT>>` — Geist (sans + mono) via next/font as the variable-grotesk
  placeholder. Self-hosted at build, OFL-licensed.
- `<<ASSET_SOURCE>>` — TBD; placeholder boxes are fine through M3 (spec §12).
- `<<CONTACT_DESTINATION>>` — placeholder `mailto:` in page.tsx; real submission
  wired in M6.
- `<<DOMAIN>>` / hosting — TBD (Vercel recommended); M8.

## Stack — verified versions (installed 2026-06-03)
next 16.2.7 · react/react-dom 19.2.4 · three 0.184 · @react-three/fiber 9.6.1 ·
@react-three/drei 10.7.7 · @react-three/postprocessing 3.0.4 (added at M5) ·
lenis 1.3.23 · zustand 5.0.14 · gsap 3.15 (added at M5 for kinetic type). TS strict.

## Architecture decisions
- **Renderer: WebGL2 (spec §5.1).** All renderer creation goes through the
  single factory `src/three/createRenderer.ts` — the only place to swap in a
  WebGPU renderer later. Never inline `new WebGLRenderer` in the Canvas.
- **Scroll: Lenis → zustand, NOT drei `ScrollControls`.** Mixing them fights
  over scroll ownership. Lenis owns DOM smooth-scroll (real native scroll, so
  `position: fixed` works behind it) and writes normalized `progress` to the
  store; the Rig reads it in `useFrame`.
- **Per-frame discipline (spec §10).** High-frequency values (scroll/progress/
  velocity) are read via `useExperience.getState()` inside `useFrame`, never via
  hook selectors — no React re-renders per frame. Only the throwaway ScrollDebug
  subscribes; the production Rig must not.
- **Layout:** root `app/` (routes, SEO, real crawlable content) + sibling `src/`
  (experience, three, ui, store, hooks, lib) per spec §5.3. Alias `@/*` → repo root.
- **Verify version-sensitive APIs against installed types before trusting the
  spec's snippets.** Already corrected: R3F v9 `gl` factory takes `DefaultGLProps`
  (params incl. canvas), not a bare canvas.

## Performance budget (HARD gates, spec §8.1)
60fps mid-range target, ≥30fps floor · <100 draw calls/frame · only the active
(+ incoming during a transition) scene rendered · dispose all GPU resources on
scene exit (`renderer.info.memory` must not climb across a full loop) · cap DPR 2.

## The six dimensions (scene = service)
1 City at night — power & light · 2 The Building — structure · 3 Steel Frame —
structure · 4 Smart Living Room — smart systems · 5 In-wall Wiring — electrical ·
6 Live Current — energy → loops to 1. Colour encodes category (§6).

## Build sequence tracker (M0→M8, gate each before the next; commit per milestone)
- [x] **M0 — Scaffold & renderer.** ✅ One lit cube in a client Canvas via the
  WebGL2 factory; Lenis writes progress to the store; clean console; 60fps.
- [x] **M1 — Scroll-as-camera spine.** ✅ Single-camera `Rig` flies a centripetal
  Catmull-Rom path (`src/experience/cameraPath.ts`) through 6 placeholder gateway
  zones + instanced debris; critical-damped scroll for cinematic weight. Verified in
  a real (visible) browser: 60fps, camZ monotonic 8→−202 through all six zones,
  lateral drift present, zero console errors, end frame holds on THE CURRENT.
- [ ] M2 — Transition system (render targets + blend shader + DimensionManager;
  disposal + active/incoming gating; stable `info.memory`).
- [ ] M3 — Loop + per-layer fog/grade; 6→1 seamless.
- [ ] M4 — Real scenes 1→6, one at a time (compressed assets, one interaction each).
- [ ] M5 — Postprocessing & kinetic typography (SplitText).
- [ ] M6 — Sound + diegetic HUD + content/CTA + skip-to-contact (invoke
  frontend-design skill for the HUD/overlay layer here).
- [ ] M7 — Quality tiers, mobile/low-tier path, prefers-reduced-motion,
  context-loss/battery fallback, keyboard a11y.
- [ ] M8 — Lighthouse/SEO/OG, analytics, deploy.

## Verification (the headless preview tab freezes rAF)
The Claude preview tab runs `visibilityState: hidden` → requestAnimationFrame is frozen
→ R3F/Lenis never tick (canvas stuck at 300×150, fps 0). Structural checks
(typecheck/lint/build, console errors, DOM/SEO) DO work there; *animated* behaviour does
NOT. To verify motion, run a VISIBLE Playwright page against the dev server:
`python scripts/verify-dive.py` (screenshots → <temp>/electrico-verify/). It uses dev-only
`window` hooks `__experience` (store), `__lenis`, `__camera`, driving
`__lenis.scrollTo(p*limit,{immediate:true})` and reading `__camera.position`.
GOTCHA: after editing, Turbopack HMR can desync `.next` (500 "global-error … React Client
Manifest"). Restart with a cleared `.next` (`rm -rf .next`) before verifying — don't trust
HMR for a verification run.

## Commands
`npm run dev` (Turbopack) · `npm run build` · `npm run typecheck` · `npm run lint`
