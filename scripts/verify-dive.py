"""Real-browser verification harness for the Electrico "Dive" (see CLAUDE.md §Verification).

WHY: the Claude preview tab runs visibilityState=hidden, which freezes
requestAnimationFrame, so R3F's render loop and Lenis never tick there. This drives
a VISIBLE headless Chromium page against the running dev server so *animated*
behaviour (the camera path, scroll-scrubbing) can actually be asserted.

USAGE:
  1) Start the dev server (npm run dev; default port 3013). After any edit, restart
     with a cleared .next  ->  Turbopack HMR can desync the RSC manifest.
  2) python scripts/verify-dive.py
  Screenshots land in <temp>/electrico-verify/.

Relies on dev-only window hooks set by the app (stripped from production builds):
  __experience (zustand store getState), __lenis (Lenis instance), __camera (THREE camera).
"""
import json, os, tempfile
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
URL = f"http://localhost:{PORT}"
OUT = os.path.join(tempfile.gettempdir(), "electrico-verify")
os.makedirs(OUT, exist_ok=True)

# Enable SwiftShader WebGL in headless + stop Chromium backgrounding the page
# (backgrounding freezes requestAnimationFrame, the very thing we're working around).
LAUNCH_ARGS = [
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-background-timer-throttling",
    "--disable-features=CalculateNativeWinOcclusion",
]

errors = []


def on_console(msg):
    if msg.type == "error":
        errors.append(msg.text)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=LAUNCH_ARGS)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.on("console", on_console)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))

    page.goto(URL, wait_until="networkidle")
    page.bring_to_front()
    page.wait_for_timeout(2000)  # let R3F + Lenis spin up

    health = page.evaluate("""async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        let f = 0, stop = false; const t0 = performance.now();
        const tick = () => { f++; if (!stop) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        await sleep(800); stop = true;
        const c = document.querySelector('.experience-root canvas');
        const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
        return {
            vis: document.visibilityState,
            fps: Math.round(f / ((performance.now() - t0) / 1000)),
            canvas: c ? { w: c.width, h: c.height } : null,
            renderer: gl ? gl.getParameter(gl.RENDERER) : null,
            hasLenis: !!window.__lenis, hasCamera: !!window.__camera, hasStore: !!window.__experience
        };
    }""")
    print("HEALTH:", json.dumps(health, indent=2))
    print("ERRORS:", json.dumps(errors[:20], indent=2))

    samples = []
    if health.get("hasLenis") and health.get("hasCamera"):
        for target in [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]:
            page.evaluate(
                "(t) => { const l = window.__lenis; l.scrollTo(t * l.limit, { immediate: true }); }",
                target,
            )
            page.wait_for_timeout(1100)  # let the rig's critical-damping settle
            s = page.evaluate("""() => {
                const cam = window.__camera; const st = window.__experience.getState();
                return { progress: +st.progress.toFixed(3), dim: st.dimension,
                         camX: +cam.position.x.toFixed(2), camY: +cam.position.y.toFixed(2), camZ: +cam.position.z.toFixed(2) };
            }""")
            s["target"] = target
            samples.append(s)
            page.screenshot(path=os.path.join(OUT, f"verify-{int(target * 100):03d}.png"))
        print("SAMPLES:", json.dumps(samples, indent=2))
    else:
        print(
            "SKIPPED samples - dev hooks not present. If ERRORS shows a 500 / "
            "'React Client Manifest', clear .next and restart the dev server."
        )

    browser.close()
