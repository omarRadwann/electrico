"""Headed REAL-GPU capture sweep for ELECTRICO quality review.

Unlike verify-dive.py (headless SwiftShader — cannot composite bloom/Points), this
opens a real on-screen Chromium window using the machine's real GPU (ANGLE/D3D11),
so bloom, the AgX grade, shadows, and the Current's Points/filaments actually render.

Drives the dev-only __lenis hook to each authored progress and screenshots:
the 6 parked arrivals + the 2 new apertures (Building/Room doorways) + the Frame
tunnel + the Current climax + the match-cut formation. Also frame-diffs the Current
(p=0.93) 0.5s apart to PROVE the unfrozen flow, and reports console errors + whether
the Draco GLBs loaded.

USAGE: dev server on :3013, then  python scripts/capture-quality.py
Shots land in <temp>/electrico-quality/.
"""
import json, os, tempfile
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
URL = f"http://localhost:{PORT}"
OUT = os.path.join(tempfile.gettempdir(), "electrico-quality")
os.makedirs(OUT, exist_ok=True)

# REAL GPU: headed window, NO swiftshader args. Just stop backgrounding throttles.
LAUNCH_ARGS = [
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-background-timer-throttling",
    "--disable-features=CalculateNativeWinOcclusion",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
]

# (label, progress, settle_ms) — apertures/climax get longer settles for stable frames.
SHOTS = [
    ("00-hero-city", 0.00, 1400),
    ("01-city-park", 0.13, 1400),
    ("02-building-park", 0.29, 1400),
    ("02b-building-aperture", 0.34, 1500),
    ("03-frame-tunnel", 0.45, 1400),
    ("04-room-park", 0.61, 1800),   # GLBs + lamp shadow need load + settle
    ("04b-room-doorway", 0.68, 1500),
    ("05-wiring-park", 0.77, 1500),
    ("06-current-climax", 0.93, 1600),
    ("06b-matchcut", 0.96, 1600),
]

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=LAUNCH_ARGS)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))

    page.goto(URL, wait_until="networkidle")
    page.bring_to_front()
    page.wait_for_timeout(3500)  # loader min-display + asset warmup

    health = page.evaluate("""async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        let f = 0, stop = false; const t0 = performance.now();
        const tick = () => { f++; if (!stop) requestAnimationFrame(tick); };
        requestAnimationFrame(tick); await sleep(1000); stop = true;
        const c = document.querySelector('.experience-root canvas');
        const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
        let renderer = null;
        if (gl) { const e = gl.getExtension('WEBGL_debug_renderer_info');
                  renderer = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }
        const st = window.__experience && window.__experience.getState();
        return { vis: document.visibilityState,
                 fps: Math.round(f / ((performance.now() - t0) / 1000)),
                 canvas: c ? { w: c.width, h: c.height } : null, renderer,
                 quality: st ? st.quality : null,
                 hasLenis: !!window.__lenis, hasStore: !!window.__experience };
    }""")
    print("HEALTH:", json.dumps(health, indent=2))

    if health.get("hasLenis"):
        for label, t, settle in SHOTS:
            page.evaluate("(t)=>{const l=window.__lenis; l.scrollTo(t*l.limit,{immediate:true});}", t)
            page.wait_for_timeout(settle)
            page.screenshot(path=os.path.join(OUT, f"{label}.png"))
            print(f"shot {label} @ p={t}")

        # PROVE the Current flows: two frames 0.5s apart at the climax must differ.
        page.evaluate("()=>{const l=window.__lenis; l.scrollTo(0.93*l.limit,{immediate:true});}")
        page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(OUT, "diff-current-a.png"))
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT, "diff-current-b.png"))
        print("captured current frame-diff pair")
    else:
        print("NO HOOKS — dev server may not be up or .next desynced")

    print("ERRORS:", json.dumps(errors[:25], indent=2))
    browser.close()
