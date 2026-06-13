"""Headed real-GPU smoke of the LIVE site, driven by real WHEEL events (prod strips
the dev hooks, and Lenis intercepts wheel). Confirms: load OK, no console/Draco
errors, and the dive renders deep (the Room sofa must appear — the reported bug)."""
import json, os, tempfile, time
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
    page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERR: " + str(e)[:160]))
    page.on("requestfailed", lambda r: errors.append("REQFAIL: " + r.url.split('/')[-1]))

    t0 = time.time()
    page.goto(URL, wait_until="domcontentloaded")
    page.bring_to_front()
    # Wait for the loader to dismiss (the scroll cue appears) or ~12s.
    page.wait_for_timeout(11000)
    print("INITIAL WAIT done @", int((time.time() - t0) * 1000), "ms")
    page.screenshot(path=os.path.join(OUT, "v2-live-hero.png"))

    # Wheel-scroll the dive in steps; screenshot at a few depths. The hub center is
    # ~mid-viewport; wheel down advances Lenis. Big deltas + settle between shots.
    depths = [("city", 6), ("building", 10), ("frame", 8), ("room", 14), ("current", 12)]
    for name, ticks in depths:
        for _ in range(ticks):
            page.mouse.wheel(0, 900)
            page.wait_for_timeout(120)
        page.wait_for_timeout(1600)
        page.screenshot(path=os.path.join(OUT, f"v2-live-{name}.png"))
        print(f"shot v2-live-{name}")

    print("ERRORS:", json.dumps(errors[:20], indent=2), "COUNT:", len(errors))
    browser.close()
