"""Headed real-GPU smoke test of the LIVE deployed site. Prod strips dev hooks,
so scroll is driven via window.scrollTo (the HUD gauge still reflects progress).
Confirms: canvas mounts at real size, no console errors (Draco decode / asset
404s included), and the 3D renders at the hero + a mid-dive position."""
import json, os, tempfile
from playwright.sync_api import sync_playwright

URL = "https://omarradwann.github.io/electrico/"
OUT = os.path.join(tempfile.gettempdir(), "electrico-live")
os.makedirs(OUT, exist_ok=True)
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=[
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--disable-background-timer-throttling", "--ignore-gpu-blocklist",
    ])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)[:200]))
    page.on("requestfailed", lambda r: errors.append("REQFAIL: " + r.url[-60:]))
    page.goto(URL, wait_until="networkidle")
    page.bring_to_front()
    page.wait_for_timeout(5000)  # loader + asset warmup

    health = page.evaluate("""() => {
        const c = document.querySelector('.experience-root canvas');
        const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
        let r = null; if (gl){ const e=gl.getExtension('WEBGL_debug_renderer_info');
          r = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);}
        return { canvas: c ? {w:c.width,h:c.height} : null, renderer: r,
                 limit: Math.max(0, document.body.scrollHeight - innerHeight) };
    }""")
    print("HEALTH:", json.dumps(health, indent=2))
    page.screenshot(path=os.path.join(OUT, "live-hero.png"))

    # mid-dive (~Room) and near-end (~Current) via native scroll
    for frac, name in [(0.61, "live-mid"), (0.95, "live-end")]:
        page.evaluate("(f)=>window.scrollTo(0, document.body.scrollHeight*f)", frac)
        page.wait_for_timeout(2500)
        page.screenshot(path=os.path.join(OUT, name + ".png"))

    print("ERRORS:", json.dumps(errors[:20], indent=2), " COUNT:", len(errors))
    browser.close()
