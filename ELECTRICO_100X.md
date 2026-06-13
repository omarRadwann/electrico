# ELECTRICO — "The Dive" — 100X Operator Briefing for Claude Code

> **TL;DR:** ELECTRICO is a genuinely senior piece of WebGL craft that currently converts at
> **zero by construction**, and four verified silent engine failures mean the shipped site is
> materially worse than what was built. Fix the silent failures, redesign the ending so the
> endless loop stops eating the only CTA, give the dive a commercial spine (WhatsApp-first,
> trust content, case vitrines), raise the weakest three dimensions to the City's bar, and
> ship the one signature moment — *the current resolving into the city's lights*. Numbers
> over vibes. Conversion over spectacle. No downgrades. No slop.

This document supersedes prior briefings. It is grounded in a seven-agent audit
(2026-06-11) of the repo at `E:\master_3D\Electrico` (HEAD `b8decd7`) and the live site at
https://omarradwann.github.io/electrico/ — every finding below cites file:line and was
verified against source (including the installed `@react-three/fiber` 9.6 dist), not guessed.

---

## 0. ROLE

You are operating as a single integrated specialist combining:

- Awwwards-jury-level creative director
- Senior Three.js / WebGL / React Three Fiber engineer (R3F v9 internals included)
- B2B lead-generation strategist for the Egypt/GCC contractor market
- Cinematic motion designer and lookdev/CGI art director
- Sound designer (Web Audio synthesis + mix discipline)
- Performance engineer (GPU / CPU / network / asset pipeline)
- Accessibility, localization (AR/EN), and responsive QA lead
- Release engineer (CI/CD, budgets-as-gates, real-device verification)
- Ruthless product-quality reviewer

You are not a generalist assistant on this task. Act with the taste, restraint, and rigor of
a senior contractor responsible for someone else's flagship — and for their **pipeline of
inquiries**, not just their pixels.

---

## 1. MISSION

**Project:** ELECTRICO — a scroll-driven, one-camera cinematic dive through six nested
dimensions (City→Building→Frame→Room→Wiring→Current→loops to City), each dimension a
service of an electrical / structural / smart-home company.

**Deliverable:** an experience that is simultaneously
**(a)** an Awwwards-SOTD-credible piece of craft — cinematic, tactile, materially honest,
stable on real machines — and
**(b)** a working lead-generation machine for a Cairo/GCC contractor — trusted, measurable,
reachable on WhatsApp, rankable on search.

**Non-goal:** more 3D. The world exists and its architecture is right. The goal is to make
what exists *true* (fix silent failures), *legible* (each dimension reads as its service),
*alive* (velocity, touch, sound), and *commercial* (the dive ends in an inquiry, not a veil).

**Positioning truth (meta-finding):** no Egyptian or MENA electrical/MEP contractor has an
SOTD-level 3D site. ELECTRICO is first-mover in its category. The trait to protect is the
**continuous one-camera world** — resist any redesign toward separate per-service pages.

---

## 2. PRIME DIRECTIVES (conflict-resolution stack — top wins)

1. **Stability** — no broken builds, no broken static export, no broken basePath, no GPU
   context death without recovery.
2. **Trust** — nothing ugly, broken, frozen, or fake on any reasonable device; and
   *commercial* trust: a real company with real projects, a real phone, a real address.
3. **Conversion** — every path through the site must be able to end in an inquiry. A change
   that makes the dive prettier but the CTA harder to reach loses.
4. **Premium feel** — composition, typography, material honesty, motion rhythm.
5. **Performance headroom** — smooth on the Iris Xe floor and mid-range phones.
6. **Cinematic ambition** — signature beats, atmosphere, the one big idea.
7. **Novelty** — new tricks. Bottom on purpose.

> The FitSole stack had five rungs. ELECTRICO gets six because it is a *business* surface:
> Conversion outranks beauty here, and that is not negotiable.

---

## 3. CORE PHILOSOPHY

> **One dive, one idea. The dive earns attention; the shell converts it. Velocity is a
> second input device. Sound confirms motion. Fallbacks are simpler premium — never ugly.
> Spectacle that cannot produce an inquiry is a demo, not a website.**

The one idea is the **ENDLESS DIVE** — energy flowing through everything the company
touches, dimension 6 resolving back into dimension 1. Every polish decision either serves
that idea or serves conversion. Resist second gimmicks.

---

## 4. GROUND TRUTH — VERIFIED CURRENT STATE (2026-06-11)

### 4.1 What is already strong (PROTECT LIST — do not regress)

- **The authored camera spine** — `src/experience/cameraPath.ts`: 13 hand-placed
  {progress, position, lookAt} keys, cubic-Hermite with zero-tangent "park" arrivals,
  `ZONE_PROGRESS` derived from the same table so HUD/boundaries/dimension detection can
  never desync. This is the project's real differentiator.
- **Per-frame discipline** — every `useFrame` reads the store via `getState()`
  (Rig.tsx:41, Atmosphere.tsx:38, Transitions.tsx:28); module-scope temporaries; all
  high-frequency DOM mutated via refs in self-contained rAF loops. Zero React re-renders
  in the hot path. Keep it that way.
- **Instancing hygiene** — the reusable `beam()` lattice builder (CityInfra.tsx:67-89,
  BuildingSite.tsx:56-72, FrameScene.tsx:61-77); 1800 city windows = 1 draw; ~30-80 scene
  draws total, in winners' territory (general guidance is <500).
- **The City dimension** — four cooperating layers (CityScene towers/windows/greebles/wet
  street + CityDepth far ring + CityLife traffic/beacons + CityInfra pylons/substations),
  ~10 draws. **This is the bar the other five dimensions must be raised to.**
- **Effects tier gating without composer remount** — Effects.tsx:30-58 uses three different
  mechanisms (Pass.enabled / BlendFunction.SKIP / blend opacity), each chosen for its
  recompile cost. Sophisticated; protect.
- **Crawlable HTML behind the canvas** — app/page.tsx semantic narrative + services +
  noscript fallback; deployed head verified complete (canonical, OG + dims + alt, twitter
  card, robots, sitemap all resolve live). Rare discipline for a WebGL one-pager.
- **The diegetic HUD + loader** — depth gauge with per-zone colored ticks; loader tied to
  real `useProgress` with a 1.4s brand moment; audio correctly muted-by-default with the
  AudioContext created inside the toggle's click stack.
- **Camera-synced Narrative overlay** — Narrative.tsx reads the same store `dimension` as
  the HUD; visible copy structurally cannot drift from the framed scene.
- **Deploy plumbing** — basePath discipline airtight (asset() helper, .nojekyll, 5/5 live
  asset URLs 200), live HTML byte-identical to HEAD's `out/`.
- **The verification harness** — scripts/verify-dive.py + dev-only `window.__camera` /
  `__lenis` / `__experience` hooks asserting live camera matches authored framing.

### 4.2 THE SEVEN P0s (the site is silently broken in these exact ways)

**ENGINE — four silent failures, all verified against installed library source:**

1. **The climax doesn't move.** `CurrentScene.tsx:76-83,123-125` mutates module-scope
   `UNIFORMS.uTime.value` in `useFrame`, but R3F v9's `applyProps` **clones** each uniform
   passed via `<shaderMaterial uniforms={...}>` (verified in fiber dist
   events-b389eeca.esm.js:427-438). The write never reaches the GPU. Both particle streams
   of THE CURRENT — the dive's climax and loop hand-off — render as a **static point
   cloud**. The verb FLOW is dead.
   *Fix:* hold a `useRef<THREE.ShaderMaterial>` and write
   `mat.current.uniforms.uTime.value += dt` in useFrame (both materials). Verify on a
   headed real-GPU run: two frames 0.5s apart at p=0.93 must differ in the particle field.

2. **Every shadow on the site is dead.** `Experience.tsx:48-52` passes no `shadows` prop to
   `<Canvas>`. R3F's `configure()` runs `gl.shadowMap.enabled = !!shadows` **after** the
   custom `gl` factory returns — overriding createRenderer.ts:45-46. The Room lamp's
   castShadow ("the realism win"), the moon key + its freeze logic, the `enableShadows()`
   GLB traversal, and the tier shadowMapSize knob are all dead code at runtime. Every
   visitor sees floating, shadowless furniture.
   *Fix:* add `shadows` to the Canvas. Then defuse the two landmines that activate (§4.3 #7).

3. **Safari gets the worst build the site can produce.** `quality.tsx:44-51` classifies by
   GPU string; Safari (macOS 15+ and all iOS) masks it to literally `"Apple GPU"`, which
   matches the `/mali|adreno|powervr|apple gpu/` mobile branch → `minimal` tier: DPR 1, no
   props (no substations, pylons, work lights), no reflector. An Awwwards judge on an M3
   Max in Safari sees the floor tier; the same machine in Chrome gets `full`.
   *Fix:* "apple gpu" + non-touch/non-iOS UA → `full`; keep minimal/reduced for genuine
   mobile signals; confirm the seed with a 1-second fps probe instead of trusting strings.

4. **Mobile strands visitors on a black screen over the contact section.** Lenis is
   constructed `{ autoRaf: true, infinite: true }` (useSmoothScroll.ts:24) — but Lenis's
   own README states `syncTouch: true` is **required** for infinite on touch devices.
   Native touch scroll clamps at the document end: the loop never wraps, progress parks at
   1.0, and LoopVeil (LoopVeil.tsx:24-28) computes opacity = (1.0−0.94)/0.06 = **1.0** — a
   fully opaque fixed overlay above the content, permanently covering the contact section.
   *Fix:* branch on touch — either `syncTouch: true` (test iOS feel) or disable `infinite`
   on coarse pointers and give touch a resolved non-loop ending (§6 needs this anyway).

**CONVERSION — three structural failures:**

5. **Every route to the only CTA ends under an opaque veil.** The contact section occupies
   p≈0.875–1.0; LoopVeil ramps unconditionally over p>0.94 (33% black at 0.96, 100% at
   1.0) and Lenis infinite-wraps past it. Scroll, the skip-link (layout.tsx:66), and
   tab-focus all land on a black screen with a technically-clickable invisible button.
   CLAUDE.md's claim that "skip-to-contact handles direct access" is false — the veil has
   no exception for it.
   *Fix:* §6 — decouple conversion from the loop seam entirely.

6. **The one CTA is a dead placeholder.** `page.tsx:108-111` —
   `mailto:hello@electrico.eg`, a flagged `<<CONTACT_DESTINATION>>` placeholder on a domain
   the company does not own. Repo-wide: **zero** `tel:`, zero `wa.me`, no form. For a
   market where WhatsApp is the default B2B channel, the site has no working inbound
   channel. Leads silently vanish.

7. **Zero trust content.** No projects, no clients, no certifications, no address, no
   service area, no footer, no legal entity, ~150 words of poetic copy. A property
   developer evaluating a contractor has nothing to verify the company exists — the
   beautiful dive actively raises "is this real?" and the page never answers.

### 4.3 P1 — clearly below premium (fix in the phases, §17)

1. **AgX tone mapping silently overridden to ACESFilmic** — createRenderer.ts:37-42 sets
   AgX; R3F `configure()` overwrites it (no `flat` prop → ACESFilmic). The shipped grade is
   not the signed-off grade. *Fix:* set tone mapping in Canvas `onCreated` (runs after
   configure), then re-judge bloom threshold/exposure on a real GPU.
2. **Atmosphere desynced from arrivals** — Atmosphere.tsx:39-44 lerps fog/bg on uniform
   zone spacing (0, .2, .4 …) while authored arrivals sit at 0.13/0.29/0.45/0.61/0.77/0.93.
   At the held City arrival the amber fog is already 65% replaced by the Building's cool
   tint; atmosphere leads the camera by up to half a dimension everywhere. *Fix:*
   piecewise-remap p through `ZONE_PROGRESS` (math.ts `remap` exists).
3. **Boundary flash is progress-shaped, not event-shaped** — Transitions.tsx:28-46: park
   near a boundary and a permanent ~72%-opacity additive wash sits on the frame; creeping
   and blasting through produce identical flashes; the flash fires at full strength under
   prefers-reduced-motion (photosensitivity). *Fix:* edge-detect boundary crossings in the
   Rig → 250–400ms time-based envelope scaled by |velocity|; attenuate/skip on reduced
   motion; add a 150–300ms chromatic-aberration + radial displacement kick (animate the
   existing CA offset uniform — the Igloo "falling-through" recipe).
4. **toneMapped:false leaking onto lit PBR materials** — FrameScene.tsx:169,
   RoomScene.tsx:23-28, WiringScene.tsx:43-45, CityInfra.tsx:160-166,
   BuildingScene.tsx:261-270. Their lit response bypasses the filmic grade and clips to
   saturated neon — the single biggest source of the "cheap neon" read. *Rule:*
   `toneMapped:false` is for pure-glow `meshBasicMaterial` light cards ONLY; standard
   materials go `toneMapped:true` and recover bloom punch via emissiveIntensity (bloom
   reads pre-tonemap HDR at threshold 0.55).
5. **Three always-on hidden render passes** violate the project's own budget: the
   Building's transmission glass re-renders the opaque scene every frame untier-gated; the
   City reflector RT runs while the camera is 170 units away; the Room lamp is a
   shadow-casting POINT light (6 cube faces, 1024px, never frozen, all tiers).
   *Fix:* progress-gate all three (visible/castShadow only within their dimension band);
   cheap two-layer fake glass on reduced/minimal.
6. **Camera clips through hero geometry.** (a) Building glass curtain: the camera crosses
   the glass plane at p≈0.339 inside the plane bounds while the flash is only at 44%
   opacity — a visible near-plane slice of a transmissive plane **every loop**
   (BuildingScene.tsx:244-256 vs cameraPath.ts:82-83). *Fix:* author a real aperture — cut
   a door-sized opening with a mullion frame ring and fly through it ("entering the
   building" becomes a beat, not an artifact). (b) Wiring conduits: curves are jittered
   around the camera line; for many seeds a tube crosses the camera axis and gets
   near-plane sliced, backface-hollow (WiringScene.tsx:16-40). *Fix:* clearance cylinder —
   push curve points within r<1.2 of the camera line radially out; DoubleSide or capped.
7. **Shadow landmines (activate after P0 #2 lands):** the moon-key shadow freeze counts 12
   frames from Lighting mount while scenes' GLBs arrive via Suspense later — on real
   networks the depth map can freeze EMPTY and full-tier visitors get zero directional
   shadows (Lighting.tsx:28-33). *Fix:* drive the freeze from load completion
   (`useProgress` done), not a frame count; gate and freeze the Room lamp too.
8. **Reduced-motion path does not reduce motion** — quality.tsx:65-101 only pins quality to
   `minimal` (LESS detail, SAME motion — backwards). *Fix:* on reducedMotion, crossfade
   between the six parked keyframe stills (`sampleCamera` at ZONE_PROGRESS), disable Lenis
   lerp/infinite, keep props ON, step Narrative/HUD per section.
9. **No WebGL context-loss handling anywhere** — a GPU reset freezes the canvas on its last
   frame forever, HTML scrolling behind it. *Fix:* `webglcontextlost` preventDefault +
   `webglcontextrestored` → remount Canvas via key bump.
10. **Reverse-entry glitch** — first gesture scroll-UP wraps 0→0.97: Rig snap teleports to
    the climax and the veil pops at ~50% with no ramp. *Fix:* block backward wrap until a
    `completedOnce` store flag is true.
11. **First impression vs payload** — full experience ≈ **6.9MB** over the wire; the loader
    force-dismisses at 7s (Loader.tsx:28) — on median 4G (~10-12s) visitors dive into a
    world with furniture/IBL/textures visibly popping in. *Fix:* §11 asset pipeline +
    progressive dimension streaming + gate the loader on dimension-1 assets only.
12. **3D bundle not code-split** — page.tsx statically imports Experience; a single 1.43MB
    raw / 466KB gz chunk sits in the initial script list. *Fix:*
    `next/dynamic(() => import(...), { ssr: false })`; shell hydrates instantly, 3D streams
    behind the loader; low-tier/reduced-motion devices never download it.
13. **ExperienceBoundary leaves six blank 100vh screens** — beat sections are
    unconditionally `opacity:0` (globals.css:163-169) because the canvas overlay replaces
    them; when WebGL fails there is no overlay. *Fix:* `.no-3d` class on failure restores
    beat copy; mirror in `<noscript>`.
14. **Sound is test tones** — ambientEngine.ts architecture is right (muted default,
    gesture-gated, per-dimension crossfade) but the patch is six static raw oscillators; no
    boundary stingers, no velocity coupling, no reverb space, drones on when tab is hidden,
    preference not persisted. *Fix:* §10.
15. **No analytics of any kind** — a lead-gen site that cannot count visitors, dive depth,
    or CTA clicks cannot be tuned. None of the P0s above would ever have surfaced from the
    field. *Fix:* §13.
16. **SEO surface is one URL, no structured data, no geography** — no JSON-LD
    (LocalBusiness/Service), sitemap has exactly one URL, no Cairo/Egypt/GCC anywhere in
    meta. *Fix:* §12.
17. **Heavy textures** — metal_rough_1k.jpg (775KB) + metal_nor_gl_1k.jpg (770KB) are 4-6×
    normal for 1k (q~100 export). *Fix:* re-encode q75/q85 → ~1.2MB saved, zero code.

### 4.4 P2 — polish debt (batch into adjacent phases)

- Wiring band instancing overflow: capacity 16, writes 24 — 8 bands silently degenerate
  (WiringScene.tsx:175 vs 96-115). Allocate from data; dev-assert capacity.
- Dead/incoherent tier knobs: `lut` flag has no effect; `anisotropy` declared 8/4/1 but
  hardcoded to 4 in useSurfaceMaps.ts:26; CityScene comment says reflector 128, code says 96.
- Boot tier runs full-fat on every device before the seed lands (store defaults `'full'`,
  N8AO render targets allocated on ALL tiers). Default `'reduced'`; mount N8AO conditionally.
- Per-frame full instanceColor buffer uploads (CityScene:145-155 — 1800 instances to change
  4 windows; AmbientDebris:53-64). Use addUpdateRange or batch to every 3rd frame.
- Window flicker is instant hard pops — give each flickering window a 0.3–1.5s ease.
- Camera far=2000 with a world that ends at ~250 — wastes depth precision N8AO/DOF depend
  on. Set far≈300.
- Building facade: ±0.4 jitter on a 2-unit grid reads as a drunken curtain wall (regularity
  belongs in position, variation in brightness — which already exists); no mullions/slab
  lines; glass doubles transmission WITH opacity (physically wrong, milky). 
- envIntensity 0.16/0.14/0.11 starves the IBL — the Lightformer speculars and the 2.4MB of
  surface maps are nearly invisible; concrete_ao_1k.jpg (377KB) is shipped and never
  referenced. After the Frame emissive fix, raise to ~0.35–0.45 and re-judge.
- Traffic streaks can clip tower corners (CityLife.tsx:48-56) — clamp tower half-width.
- Wiring circuit bands: four saturated primaries in the most monochrome dimension —
  desaturate ~40%, keep below bloom threshold (printed insulation, not party lights).
- Two simultaneous `<h1>`s during load; heading order h1→h3; #contact missing tabindex=-1;
  sound toggle has no :focus-visible.
- Site-wide text unselectable (.content pointer-events:none) — a B2B visitor cannot copy
  the email. Opt #services/#contact back in.
- Loader never unmounts — 16 infinite spark animations run behind opacity:0 forever.
- og:title bare "ELECTRICO"; og.png 363KB and includes HUD chrome; no apple-touch-icon;
  toggle copy says "tap" on desktop.
- Models ship as uncompressed .gltf+bin+jpg (2.24MB) — gltf-transform/gltfpack meshopt+WebP
  → ~600-800KB. HDRI 1.7MB for blurred IBL — 512px or gainmap ≈150-400KB.
- GH Pages caps Cache-Control at 600s — platform limit; solved by the M8 move (don't
  engineer around it).

---

## 5. ABSOLUTE PROHIBITIONS

You may not:

- Guess at code behavior — read the source. When a library boundary is involved (R3F
  configure(), Lenis touch, drei internals), **read the installed dist/types**, not docs
  from memory. Three of the four engine P0s were library-boundary betrayals.
- Trust CLAUDE.md's tracker or comments over current source — both were stale/false in
  verified places (the createRenderer comment describes tone mapping that never happens).
- Mutate the object passed to `<shaderMaterial uniforms={…}>` and expect the GPU to see it
  (R3F clones it). Material ref + `mat.current.uniforms.X.value` in useFrame. Always.
- Call setState inside useFrame, or subscribe a hot-path component to high-frequency store
  values via hook selectors. `getState()` in useFrame; refs for DOM.
- Inline `new WebGLRenderer` anywhere — all renderer creation goes through
  `src/three/createRenderer.ts` (the future WebGPU swap point).
- Use drei ScrollControls or any second scroll owner — Lenis → zustand is the one clock.
  When GSAP/ScrollTrigger lands, it scrubs from the same store progress, never native scroll.
- Break static export, GitHub Pages basePath, or the `asset()` helper.
- Downgrade a working surface to "fix" performance; reduce DPR below 1.0; let any fallback
  be ugly rather than simpler-premium.
- Remove a working feature without an equal-or-better replacement.
- Ship placeholders as live conversion surfaces (the mailto P0 must never recur — see the
  Owner-Input Manifest, §16: unshippable items are listed there).
- Add decorative noise: random gradients, fake HUD greebles without diegetic purpose,
  generic SaaS cards, copilot-button styling. The HUD is the dive's instrumentation or it
  doesn't exist.
- Add backend-dependent features that can't run on static export (forms go through
  Formspree/Web3Forms-class endpoints or wa.me links).
- Verify motion/glow claims headless — SwiftShader cannot composite bloom/float-target
  postprocessing and the preview tab freezes rAF. Headed real-GPU Playwright only (§15.4).
- Leave `Math.random()`-seeded layout where it can impale the camera (Wiring) — authored
  worlds get authored (or constraint-clamped) randomness.

---

## 6. THE ENDING — CONVERSION ARCHITECTURE (P0, design-level)

The endless loop is the signature AND it currently destroys the funnel. Resolve the
conflict by **moving conversion out of the scroll spine**:

1. **Contact terminal as an overlay state, not a scroll section.** A store-driven, diegetic
   "control room" panel rendered above the veil's z-index (z-50), reachable from every
   dimension via a persistent HUD affordance and the depth-gauge rail. The dive stays an
   endless loop — pure spectacle; the terminal is summoned, not scrolled to.
2. **The terminal is the dive's own console:** quote micro-configurator in 3 steps
   (1: service = power / structure / smart in the three brand colors; 2: property type +
   area; 3: name + phone) — multi-step converts +37% vs long forms; ≤5 fields converts
   ~120% better. Default the selected service to the visitor's current dimension — **the
   dive pre-qualifies the lead.**
3. **WhatsApp-first for Egypt/GCC:** primary CTA is a `wa.me/<real number>` deep link with
   a pre-filled, dimension-aware message ("I'm interested in smart-home systems…"), plus
   `tel:` and the form as fallback. Justification: ~56M Egyptian WhatsApp users, >90% MENA
   adoption, click-to-WhatsApp ≈94% conversion lift, ≈92% lower cost-per-lead. Post a
   visible reply-time promise ("We reply on WhatsApp within 15 minutes, 9am–9pm").
4. **Specific-verb CTAs per dimension**, not "Contact us": "Book a free site visit"
   (structure), "Get a wiring assessment" (electrical), "Plan your smart home" (smart).
5. **The scroll-spine contact section** becomes a short post-veil resolved state (or moves
   before the veil zone) so keyboard/scroll users still land somewhere readable; the
   endless loop is demoted to an explicit "DIVE AGAIN" control there. The skip-link gets
   `tabindex="-1"` on its target and a veil exception.
6. **Depth-gauge ticks become navigation:** the six colored ticks (already labeled 01-06)
   get click → `lenis.scrollTo(zoneProgress*limit)`, plus a 7th "CONTACT" tick. Diegetic
   chapter nav for impatient developers, no web navbar.

**Trust layer (P0 #7):** per-dimension **case vitrines** — at each parked arrival, one real
project card in the HUD style (mono eyebrow + steel rule + one number: "14 villas wired —
New Cairo 2025" / "6,000 m² steel frame — New Capital"). Six dimensions = six case studies =
trust built inside the art. Case studies follow contractor doctrine: constraint →
engineering solution → measurable outcome. Plus a real footer: legal name, commercial
registration, address, governorate coverage, phone, social. Certifications/partner badges
(KNX, Schneider/Lutron, code compliance) in the contact terminal's first viewport — never
the footer only.

---

## 7. QUALITY TIERS (concrete — repairs + extends the existing system)

Keep the existing `full / reduced / minimal` names and the no-remount gating. Repair the
detection, the boot state, and the dead knobs.

| Capability | FULL | REDUCED | MINIMAL |
|---|---|---|---|
| DPR cap | min(dpr, 2.0) | min(dpr, 1.5) | min(dpr, 1.25) |
| DPR floor | 1.0 | 1.0 | 1.0 |
| N8AO | mounted | not mounted | not mounted |
| DOF / grain / CA | on | grain+CA only | none |
| Bloom | full res | half res | half res, tight |
| City reflector | res 96 | off | off |
| Building glass | real transmission | fake 2-layer | fake 2-layer |
| Shadows | moon + Room lamp (gated, frozen-after-load) | Room lamp only | none |
| Props (heavy iconography) | all | all | reduced — never zero* |
| Current particles | full | /2 | /4 |
| Anisotropy | 8 (actually wired) | 4 | 1 |
| frameloop | always | always | always, battery-governed |

\* `minimal` currently sets `props:false`, deleting the recognizable iconography
(substations, pylons, work lights) — the things that make scenes READ. Minimal must mean
*simpler premium*: keep silhouette-critical props, drop ornamental ones. Add a
`heavyProps`/`coreProps` split.

**Detection (combine; never one signal):** GPU string heuristic **with the Apple-GPU/Safari
rule from §4.2 #3** · UA/touch signals (`pointer: coarse`, maxTouchPoints) ·
deviceMemory/hardwareConcurrency · a 1-second fps probe to **confirm** the seed ·
prefers-reduced-motion (pins its own path, §4.3 #8 — not just a tier). Boot default is
`'reduced'` (seed only ever confirms or moves it — never let first frames run full-fat on a
weak phone). Manual override `?tier=full|reduced|minimal` stays; surface it in the debug
overlay. Between tiers, PerformanceMonitor drives **fractional DPR** (factor × tier cap) so
degradation is a slope, not three cliffs; allow careful auto-upgrade after sustained
headroom.

**Degradation order on weak devices:** reflector → transmission → N8AO/DOF → bloom res →
particle counts → shadow size/off → fractional DPR (floor 1.0). **Never:** model/prop
deletion below silhouette-critical, typography crispness, or the dignity of the core
composition.

---

## 8. DEBUG OVERLAY (mandatory — does not exist yet)

Toggleable via `?debug=1` or Shift+D, default off in prod, styled as HUD instrumentation:

```
TIER:        REDUCED (seed: gpu-string+probe)   [F][R][M]
DPR:         1.5 (cap 1.5, frac 1.0, floor 1.0)
GPU:         ANGLE (Intel, Iris Xe) · WebGL2
FPS 1s/10s:  58 / 56   FRAME: 16.8ms
DRAWS:       34 (bloom off to count — composer reads 1)
PROGRESS:    0.612  DIM: 04 ROOM  VEL: 0.0031
SHADOWS:     on (moon frozen ✓, lamp gated ✓)
TONEMAP:     AgX @ 0.8 (verify ≠ ACES!)
AUDIO:       on · bed: room · CTX: running
MEMORY:      geo 142 tex 38 (flat across loop ✓)
REDUCED-MOTION: false   CONTEXT-LOSS: 0
```

Log the same on boot. The overlay is a quality-verification tool — TONEMAP and SHADOWS
lines exist precisely because both silently lied before. Field telemetry (§13) reports the
same dimensions.

---

## 9. PERFORMANCE BUDGETS (hard gates)

Targets on REDUCED tier, Iris-Xe-class iGPU laptop (the dev machine is the floor device):

- Sustained FPS ≥ 55; never below 40 for >250ms. Mobile mid-tier ≥ 30.
- Scene draw calls < 100 (currently ~30-80 — protect as GLBs land, via instancing/atlases).
- `renderer.info.memory` flat across a full loop (geometries/textures must not climb).
- **Network (new — the budget that was missing):** initial gz JS shell < 150KB; 3D chunk
  lazy-loaded < 500KB gz; **time-to-first-dive on 4G < 5s** (gate the loader on
  dimension-1 assets only ≈1.5MB; stream dimensions 2-6 one zone ahead of the camera);
  total full-experience transfer ≤ 3MB (from today's 6.9MB).
- LCP < 2.5s · INP < 200ms (scheduler.yield()-chunked init) · CLS = 0 (canvas box reserved).
- DPR floor 1.0 — below it only in a documented emergency fallback.
- Loader anti-stick: bandwidth-aware, ≥20s ceiling — never force-dismiss into a popping world.

CI enforces: initial gz JS and total payload budgets fail the build (§14). You cannot
improve what you cannot see: the debug overlay (§8) and field telemetry (§13) land before
optimization claims.

---

## 10. SOUND DIRECTION (Awwwards scores this category; current bed would cost points)

Keep the engine architecture (one AudioContext, gesture-gated, muted default, equal-power
crossfade keyed to store `dimension`). Replace the patch:

- **Six authored beds with character:** City = distant traffic + 50Hz transformer hum ·
  Building = wind + hollow concrete reverb · Frame = metallic creaks, bolt impacts ·
  Room = warm room tone + soft device chirps · Wiring = close electrical crackle ·
  Current = rising synth drone that **resolves into the City bed across the loop seam**
  (the sound mirrors the signature visual).
- **Event one-shots welded to choreography:** relay-click/breaker-thunk on each boundary
  crossing (fired from the same edge-detected crossing as the visual flash — single source
  of truth); soft UI ticks on HUD interactions.
- **Velocity coupling:** a noise "wind" bus + filter cutoff on the active bed driven by
  |store.velocity| — sound confirms motion.
- **Space:** a small generated-IR ConvolverNode; slow LFOs on tint gain/cutoff so beds
  breathe.
- **Discipline:** duck master gain on `document.hidden`; `resume()` on visibilitychange
  (iOS); persist the toggle to localStorage; lazy-load all audio on the toggle, not boot;
  the silent experience loses nothing critical; loudness consistent across beds (no bed
  more than ±3dB from the master target).

---

## 11. ASSET PIPELINE & LICENSE LEDGER

- **Compression pass (1 day, ~6.9MB → ~2.5-3MB):** gltf-transform/gltfpack meshopt + WebP
  (later KTX2) on the three Room GLBs (2.24MB → ~700KB); re-encode metal maps q75/q85
  (−1.2MB); HDRI → 512px or gainmap (−1.1MB+; IBL is PMREM-blurred anyway); og.png →
  ~100KB. KTX2 stays compressed in VRAM — decisive on Iris Xe and unified-memory mobiles.
- **When sourced/commissioned GLBs land** (the "still box-ish" geometry jump): default
  `gltfpack -cc -tc`; UASTC (`-tu`) only for normal/emissive-critical maps; `-si 0.5-0.75`
  for background masses; pack per-dimension or as one optimized GLB behind the loader
  (Cartier pattern) so mid-scroll fetches never hitch. Copy decoders into the static export.
- **Targeted CC0 swap-ins where procedural will never win:** a real tower-crane (Building
  site), a breaker/distribution panel (the Wiring hero), a potted plant (kills the Room's
  icosphere fidelity clash). Poly Haven/Sketchfab CC0, ~1-2MB each pre-compression, same
  proven useGLTF pipeline.
- **LICENSE LEDGER (new file, `CREDITS.md`):** every external asset gets URL, license,
  transform applied. Provenance rules for any future AI-generated assets. `<<ASSET_SOURCE>>`
  stops being a placeholder.
- **Background compilation:** during the loader, `renderer.compileAsync()` all six
  dimensions against the camera so no boundary triggers a first-use shader stall.

---

## 12. SEO, STRUCTURED DATA & LOCAL SEARCH

- JSON-LD in layout.tsx: `LocalBusiness` (name, areaServed, contactPoint with
  phone/WhatsApp, sameAs) + one `Service` per service. 
- Geography in title/description once the market is confirmed ("electrical contractor
  Cairo", "smart home Egypt", New Capital).
- Grow the sitemap from 1 URL: one static route per case study + a services route — real
  crawl surface while the dive remains the front door.
- **Arabic (launch-gate decision, not nicety):** EN-only is a confirmed owner decision, but
  for Cairo/GCC lead-gen an ar-EG mirror (authored copy, RTL-aware HUD, proper Arabic
  display face paired to the Latin grade, hreflang pairs) is the single highest-leverage
  content upgrade available. Re-present to the owner with Arabic search-volume data
  (§16 manifest item).
- Local motion: Google Business Profile, review links, Facebook/Instagram presence — the
  Egyptian buyer journey runs through them before contact.

---

## 13. ANALYTICS & FIELD TELEMETRY (the site is currently flying blind)

Cookieless (Plausible/Umami — both run on static GH Pages), plus:

- **Funnel events:** loader-done · each dimension reached (store `dimension` change) ·
  loop completed · sound-on · terminal opened · configurator step 1/2/3 · WhatsApp click ·
  tel click · form submit. Dive depth (max progress) and per-dimension dwell are the
  engagement metrics; **only WhatsApp/tel/form count as conversion** (target the 2-5% B2B
  band; median is 2.9% split 1.7% form / 1.2% call).
- **RUM:** Web Vitals + FPS percentiles segmented by quality tier and GPU class;
  context-loss count; tier distribution. (The Safari P0 and the mobile veil P0 would have
  been visible in week one with this in place.)
- **Error capture:** Sentry-class, with the tier/GPU/progress attached to every event.
- Weekly review thresholds written into the operating protocol; A/B the pre-filled
  WhatsApp message copy first (highest leverage, zero 3D cost).

---

## 14. CI/CD & RELEASE ENGINEERING (four P0s shipped because nothing gates a push)

- `.github/workflows/pages.yml`: build with `NEXT_PUBLIC_BASE_PATH=/electrico` (the comment
  in next.config.ts claims this workflow exists — it does not; a plain `npm run build` +
  push 404s every asset), typecheck + lint + build gates, Lighthouse-CI with the §9 budget
  failures, deploy via actions/deploy-pages. One-command reproducible deploy with rollback.
- **Visual regression:** per-dimension golden frames at the six ZONE_PROGRESS parks,
  captured on a real-GPU runner (headed). A WebKit/Safari lane — the lane that would have
  caught the Apple-GPU tier bug.
- **Real-device release matrix (gate, not aspiration):** mid-tier Android Chrome + iOS
  Safari + macOS Safari + the Iris Xe floor laptop. The harness today is headless
  SwiftShader, which §15.4 shows cannot even see the climax.
- M8 hosting move (custom domain + Vercel/Cloudflare): immutable caching, brotli (466KB gz
  three chunk → ~380KB br), HTTP/3, and a brand-grade canonical/og:url instead of
  github.io. A visible trust upgrade.

---

## 15. OPERATING PROTOCOL

### Step A — Investigate (before any edit)
1. Read `CLAUDE.md`, this file, then the files you will touch — in chunks, not blanket.
2. **Verify version-sensitive behavior against installed dists/types** (node_modules), not
   memory or docs. R3F configure(), Lenis touch options, drei component props, and
   postprocessing pass APIs have each already betrayed an assumption here.
3. Confirm the live site state matches HEAD's `out/` before attributing anything.

### Step B — Run live
`npm run dev` (Turbopack). Exercise: cold load → first 3s → slow full dive → fast-flick
dive → reverse scroll at load → park on each boundary → each parked arrival → loop wrap ×3
→ HUD/sound toggle → contact path via every route (scroll, skip-link, keyboard, rail) →
mobile emulation + at least one real phone → reduced-motion → WebGL-disabled.

### Step C — SUPER PLAN per work package
Exact headings: Current state · Protect list · P0/P1/P2 (file, observed, cause, fix, risk)
· Phases with verification each · No-touch list · Upgrade-only proof · Conversion proof
(what makes inquiries MORE likely) · Weak-device proof. Submit, then execute without
stalling.

### Step D — Implement
Branch per phase (`polish/<slug>`). Commit per logical change. After each phase:
`npm run typecheck && npm run lint && npm run build` — fix before proceeding. Surgical
edits; five 20-line patches beat one 500-line rewrite.

### Step E — Verify (the gotchas are law)
- **Headless SwiftShader CANNOT composite bloom/float-texture postprocessing and CANNOT
  show the Points climax** — it renders the scene but glow/flow checks are meaningless
  there. Aesthetic/motion verification = **headed real-GPU Playwright**
  (`C:\tmp\electrico-verify\headed.py` template; ANGLE/D3D11, ~100fps).
- The Claude preview tab runs `visibilityState: hidden` → rAF frozen → canvas stuck at
  300×150. Structural checks only (DOM/SEO/console/typecheck).
- `python scripts/verify-dive.py` for camera/structure invariants (uses dev-only
  `__lenis.scrollTo` + `__camera` hooks).
- Turbopack HMR desyncs `.next` after edits (500 "React Client Manifest") — clear `.next`
  and restart before any verification run.
- Draw-call telemetry reads `1` under EffectComposer — count scene draws with bloom off.
- Motion proof = two timestamped frames that differ where they must (the frozen-uTime P0
  survived every headless check; only frame-diffing on a real GPU catches that class).
- Full sweep before any deploy: lint → typecheck → build → headed smoke (all 6 parks +
  3 boundaries + loop wrap + terminal) → reduced-motion → mobile breakpoints → contact
  flow on a real phone (WhatsApp link opens with the pre-filled message) → console clean →
  network clean → budgets green.

---

## 16. OWNER-INPUT MANIFEST (blocking items — placeholder-class failures become undeployable)

| # | Item | Status | Blocks |
|---|---|---|---|
| 1 | Real WhatsApp number + phone | **MISSING** | §6 entirely — conversion cannot ship degraded |
| 2 | Owned domain + real email | **MISSING** (`<<DOMAIN>>`, mailto placeholder live) | §6, §12, §14 hosting move |
| 3 | Company legal name, commercial registration, address | **MISSING** | trust footer, JSON-LD, legal |
| 4 | 3–6 real projects: photos, scope, numbers, client permission | **MISSING** | case vitrines, case-study routes |
| 5 | Certifications / partner letters (KNX, Schneider, …) | **MISSING** | trust layer |
| 6 | Service list + coverage area (Cairo? New Capital? GCC?) | **MISSING** | copy, SEO geography, CTAs |
| 7 | Arabic: go/no-go + who authors copy | **DECISION NEEDED** | §12 AR mirror |
| 8 | Tagline confirmation (current is a flagged provisional) | **PENDING** | hero copy |
| 9 | Brand colors/font sign-off (current = spec placeholders) | **PENDING** | identity lock |
| 10 | Lead-handling SLA (who answers WhatsApp, hours) | **MISSING** | reply-time promise |

Items 1-2 are hard launch gates: the site must not take traffic while its only CTA bounces.
Everything else ships degraded with an explicit note, never silently.

---

## 17. PHASE BLUEPRINT (gate each before the next; commit per phase)

### Phase 0 — TRIAGE (days, not weeks — the site is live and lying)
Fix the four silent engine P0s (§4.2 #1-4) + the veil/CTA hotfix (cap veil, veil exception
for skip, real contact destination the moment the owner supplies it) + defuse the two
shadow landmines + AgX restoration via onCreated.
**Acceptance:** headed real-GPU frame-diff shows Current particles flowing; Room sofa casts
a lamp shadow; Safari (or WebKit Playwright) seeds `full` on desktop; a phone can reach and
read the contact content; tone mapping verifies AgX in the debug line.

### Phase 1 — TRUTH (measure before further change)
Debug overlay (§8) · analytics + RUM + error capture (§13) · CI deploy workflow + budget
gates + WebKit lane (§14) · per-dimension golden frames · baseline numbers documented.
**Acceptance:** a push cannot deploy without gates; the team can see tier/fps/funnel from
the field.

### Phase 2 — THE ENDING (conversion architecture, §6)
Contact terminal overlay · WhatsApp-first CTA stack + configurator · rail navigation +
CONTACT tick · post-veil resolved state + reverse-wrap block · trust footer.
**Acceptance:** every input modality (scroll, touch, keyboard, rail, skip-link) reaches a
readable, working conversion surface; events fire; a test inquiry arrives on WhatsApp.

### Phase 3 — CROSS-DEVICE QUALITY
Code-split the 3D island · asset compression pass (§11) · progressive dimension streaming +
loader gating on dimension-1 · boot tier 'reduced' + tier repairs (dead knobs, props split)
· progress-gating of transmission/reflector/lamp · context-loss recovery · true
reduced-motion path · `.no-3d` fallback · mobile design pass (portrait framing, thumb-reach
HUD, 100svh, battery governor).
**Acceptance:** §9 budgets green on the Iris Xe floor and a mid-tier phone; time-to-first-
dive <5s on throttled 4G; reduced-motion shows stepped stills; killing WebGL shows a
designed poster edition, not blank screens.

### Phase 4 — LOOKDEV (raise the weakest three to the City's bar)
toneMapped discipline sweep (§4.3 #4) · WIRING: procedural wall cavity (studs, junction
boxes, clamps — the `beam()` pattern), traveling-pulse emissive along tube u-coordinate,
clearance cylinder, hero panel rescale/reframe + conductors converging INTO it · FRAME:
dark tonemapped PBR steel + per-instance emissive mask via instanceColor
(onBeforeCompile) driven by FrameSurge node proximity — the surge lights the members it
rides; third bay; I-beam profile · CURRENT: velocity-stretched instanced filament quads
with curl-noise drift + DPR-correct sizing (dots become streaking current) · ROOM: domestic
shell (~18×20, ceiling + recessed downlight, window cutout showing the night city), CC0
plant swap, real shelf geometry · BUILDING: aperture fly-through, mullion grid, kill
position jitter, fix doubled glass, optional interior-mapping shader on lit windows (the
single biggest realism-per-millisecond upgrade) · CITY: flicker easing, lane clamp, IBL
raise + AO map wire-or-delete.
**Acceptance:** each dimension passes the rubric (§19) at its parked arrival on a real GPU;
materials read physically true; no neon clipping; no camera clips.

### Phase 5 — MOTION & INTERACTION ALIVE
Velocity as second input (FOV stretch, debris streaks, bloom flare, Current flow speed,
Wiring pulse speed, City traffic) · event-shaped boundary flashes + CA kick · diegetic
apertures per boundary — the **wall-socket dive** (Room→Wiring) is the killer; wireframe
dissolve (Building→Frame, the "engineering rigor" move) · one tactile moment per dimension
(pointer-proximity window flicker; device toggle in Room; conduit hover surge; curl-noise
cursor repulsion in Current) · cursor reticle per dimension + the FBO blob x-ray
(wall↔wiring reveal, Lando recipe — port from the local deep-dive) · kinetic SDF dimension
wordmarks with velocity smear · idle attract mode after ~10s.
**Acceptance:** flick the wheel and the world answers; every boundary feels like falling
through a threshold; reduced-motion exempt from all of it.

### Phase 6 — SOUND 2.0 (§10)
**Acceptance:** sound on/off both premium; boundary stingers sample-locked to the visual
crossing; loudness consistent; persists; iOS resume verified.

### Phase 7 — CONTENT, TRUST & SEARCH
Case vitrines with real projects · concrete copy layer under the poetic lines (one poetic +
one factual sentence per service) · JSON-LD + geography + case-study routes (§12) · Arabic
mirror if green-lit · legal/privacy page + credentials footer.
**Acceptance:** a skeptical developer can verify the company in 30 seconds; crawl surface
>1 URL; copy sells without losing the noir voice.

### Phase 8 — SIGNATURE & LAUNCH
**The match-cut loop:** the Current's filaments resolve INTO the City's lit windows across
the wrap seam (sample ~200 window world-positions, lerp particle targets as p→1) — "the
current becomes the city's light" is the company thesis in one camera move; spend polish
budget here before anywhere else. · Power-switch loader finale (at 100% the switch flips,
the city's 1800 windows cascade ON — loading completion IS the product) · blackout easter
egg at the contact zone (kill the city, relight district by district, reveal "Keep your
current alive — talk to us") · custom domain + hosting move · Awwwards submission kit
(captured trailer, making-of/case-study page, jury-facing notes) · social cut-downs
(Instagram/LinkedIn where Egyptian contractors win work) · launch sequence: soft QA →
submission window → social drop.
**Acceptance:** the loop seam is invisible-but-felt on a real GPU; the easter egg is
discoverable and shareable; submission assets exist; analytics dashboards live.

---

## 18. REFERENCE QUALITY BAR (study, do not copy)

**Local library first** — `C:\Users\acer\Desktop\AWWWARDS\00-MASTER.md` + the four
deep-dives (Lando Norris = FBO blob cursor + velocity-skew marquee; Cartier WAW = six
universes/one payload, doorway transitions, 6-dot rail, layered audio; Oryzo = baked
camera, velocity motion-blur GLSL, loader-morphs-into-product; MANA = pinned kinetic hero,
color worlds, footer easter egg). Read before any polish milestone.

**Sector winners 2024-26:** Igloo Inc (SOTY 2024 — the canonical dive; background shader
compilation, payload smaller than images, CA+frost transitions) · Terminal Industries
(SOTD 2025 — photoreal→wireframe dissolve, "rigor without shouting") · ON Energy (SOTD
2026 — two-color restraint, mouse-reactive energy stream, data viz) · Silver Pinewood
(one hero object + geometric layout echo) · OH Architecture (content outscored creativity —
juries now reward substance in B2B) · KKL Luzern (the experience→configurator→inquiry
bridge) · OceanX 2025, iyO (current transition/configurator meta).

**Tech currency (post-launch, not mid-milestone):** three r171+ WebGPU is production-ready
with auto WebGL2 fallback — the swap lives entirely inside `createRenderer.ts` (built for
exactly this); author new shaders in TSL; compute particles move the Current's ceiling from
~50K to 1M+. Do NOT migrate before launch; three 0.184 WebGL2 is the right call through M8.

---

## 19. REVIEW RUBRIC (per surface, judged at the parked arrival on a real GPU)

**Read:** does the dimension read as its service in <1s at full scroll speed?
**Materials:** copper, steel, glass, concrete, fabric — physically true? Emissive
discipline (only light sources skip the grade)?
**Lighting:** key/fill/rim hierarchy, grounding contact, shadows present and correct.
**Motion:** the one-verb animation alive? Velocity-coupled? Dead zones? Nausea?
**Transitions:** boundary feels like falling through a threshold; no parked-wash artifact.
**Composition:** focal hierarchy at the authored framing; HUD legible; type crisp.
**Sound:** bed matches the dimension; events land with the visuals.
**Conversion:** can I reach a working CTA from here in ≤2 interactions? Would I trust this
company with a villa?
**Performance:** budgets green on the floor device; no hidden always-on passes.
**Access:** keyboard path, focus visible, reduced-motion equivalent, contrast ≥4.5:1.

A surface fails if any line scores below premium.

---

## 20. STOP-AND-ASK CONDITIONS

Pause and surface a question only if: a fix risks the conversion flow or deletes a working
feature with no better replacement · static export/deploy breaks non-obviously after one
attempt · a dependency change would alter the deploy target · intended behavior is
undeterminable from source+docs and a wrong guess degrades UX · an Owner-Input item (§16)
blocks the current phase · "premium" has multiple plausible readings and rework would be
expensive. Do **not** pause for stylistic micro-decisions, minor-version bumps,
behavior-preserving refactors, or anything this document already rules on.

---

## 21. CONTEXT DISCIPLINE

Read files in chunks; keep a running decision log; never re-litigate the plan mid-phase;
prefer surgical patches; if a file is 600 lines and you need 30, change 30. Update
`CLAUDE.md`'s tracker and decisions at every phase gate — its staleness is how a false
comment about tone mapping survived three milestones.

---

## 22. FINAL REPORT (required at the end of every engagement)

1. SUPER PLAN status per phase (completed/partial/skipped + reasons)
2. Summary of changes + files changed
3. Root causes fixed, named specifically (library-boundary class vs authored class)
4. Tier behavior old vs new, per tier, with the Safari/mobile proof
5. Budgets: measured numbers vs §9 gates (paste outputs)
6. Conversion proof: the working funnel demonstrated end-to-end (test inquiry screenshot)
7. Verification commands + headed-run frame evidence per dimension
8. Before/after honest experience summary
9. Top 10 remaining issues ranked by impact
10. Awwwards-credible now? (honest yes/no + which category scores move)
11. Safe to deploy? (yes/no + conditions, §16 gate status)
12. Manual checks for the human: strong laptop, Iris Xe floor, real Android, real iPhone,
    macOS Safari, `chrome://gpu`, debug overlay reading, reduced-motion comparison,
    WhatsApp message arrival.

---

## 23. QUALITY BAR — DEFINITION OF DONE

"It builds" is not done. "It looks better on my machine" is not done. "The dive is
beautiful" is **not done**.

Done is: **the four silent failures verifiably dead on a real GPU · every input modality
reaching a working CTA · a measurable funnel emitting events · budgets green on the Iris Xe
floor and a mid-tier phone · materials true, weakest dimensions raised to the City's bar ·
the loop closing as a match-cut, not a veil · the company verifiable by a skeptical
developer in 30 seconds · clean console, clean network, gates enforced in CI.**

Begin with Step A (§15). Do not skip to implementation. Phase 0 is the highest-leverage
day of work available on this project.
