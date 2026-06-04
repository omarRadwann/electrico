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
        const info = (window.__gl && window.__gl.info) ? window.__gl.info.render : null;
        return {
            vis: document.visibilityState,
            fps: Math.round(f / ((performance.now() - t0) / 1000)),
            canvas: c ? { w: c.width, h: c.height } : null,
            renderer: gl ? gl.getParameter(gl.RENDERER) : null,
            drawCalls: info ? info.calls : null,
            triangles: info ? info.triangles : null,
            hasLenis: !!window.__lenis, hasCamera: !!window.__camera, hasStore: !!window.__experience
        };
    }""")
    print("HEALTH:", json.dumps(health, indent=2))
    print("ERRORS:", json.dumps(errors[:20], indent=2))

    # Sample at the authored keyframe progresses (start, the 6 park'd arrivals,
    # end) — where sampleCamera() returns the keyframe verbatim, so the live camera
    # must match the authored framing exactly. The NEW invariant is ORIENTATION:
    # the camera's world-direction must point along (lookAt - position).
    import math

    def norm(a):
        m = math.sqrt(sum(c * c for c in a)) or 1.0
        return [c / m for c in a]

    def dist(a, b):
        return math.sqrt(sum((a[i] - b[i]) ** 2 for i in range(3)))

    POS_TOL = 0.6   # parallax is 0 at pointer-center; allow tiny damping residual
    DIR_DOT = 0.99  # cos angle between actual + authored forward

    samples = []
    fails = []
    if health.get("hasLenis") and health.get("hasCamera") and health.get("hasStore"):
        for target in [0.0, 0.13, 0.29, 0.45, 0.61, 0.77, 0.93, 1.0]:
            page.evaluate(
                "(t) => { const l = window.__lenis; l.scrollTo(t * l.limit, { immediate: true }); }",
                target,
            )
            page.wait_for_timeout(1100)  # let the rig's critical-damping settle
            s = page.evaluate("""() => {
                const cam = window.__camera; const st = window.__experience.getState();
                const info = (window.__gl && window.__gl.info) ? window.__gl.info.render : null;
                const dir = cam.position.clone(); cam.getWorldDirection(dir); // writes + returns unit dir
                const authored = window.__sampleCamera ? window.__sampleCamera(st.progress) : null;
                return {
                    progress: +st.progress.toFixed(4), dim: st.dimension,
                    calls: info ? info.calls : null,
                    camPos: [cam.position.x, cam.position.y, cam.position.z],
                    camDir: [dir.x, dir.y, dir.z],
                    authPos: authored ? [authored.pos.x, authored.pos.y, authored.pos.z] : null,
                    authLook: authored ? [authored.look.x, authored.look.y, authored.look.z] : null,
                };
            }""")
            ok = True
            note = ""
            if s["authPos"] and s["authLook"]:
                pos_err = dist(s["camPos"], s["authPos"])
                exp_dir = norm([s["authLook"][i] - s["authPos"][i] for i in range(3)])
                dir_dot = sum(s["camDir"][i] * exp_dir[i] for i in range(3))
                s["posErr"] = round(pos_err, 3)
                s["dirDot"] = round(dir_dot, 4)
                ok = pos_err <= POS_TOL and dir_dot >= DIR_DOT
                if not ok:
                    note = f"posErr={pos_err:.2f}(<= {POS_TOL}) dirDot={dir_dot:.3f}(>= {DIR_DOT})"
                    fails.append({"target": target, **{k: s[k] for k in ("posErr", "dirDot")}, "note": note})
            s["target"] = target
            s["framingOK"] = ok
            # trim raw arrays for readable logging
            for k in ("camPos", "camDir", "authPos", "authLook"):
                if s.get(k):
                    s[k] = [round(c, 2) for c in s[k]]
            samples.append(s)
            page.screenshot(path=os.path.join(OUT, f"verify-{int(target * 100):03d}.png"))
        print("SAMPLES:", json.dumps(samples, indent=2))
        if fails:
            print(f"FRAMING FAILURES ({len(fails)}):", json.dumps(fails, indent=2))
        else:
            print("FRAMING: all", len(samples), "keyframes matched (position + orientation). PASS")
    else:
        print(
            "SKIPPED samples - dev hooks not present. If ERRORS shows a 500 / "
            "'React Client Manifest', clear .next and restart the dev server."
        )

    browser.close()
