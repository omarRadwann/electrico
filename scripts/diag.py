"""Per-tier diagnostic via the ?tier= URL override (clean boot per tier — no
PerformanceMonitor fight). Loads fresh for each tier, waits for full asset load,
captures the Room/Frame/Building/Current parks. Reports load time + console errors."""
import json, os, tempfile, time
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
BASE = f"http://localhost:{PORT}"
OUT = os.path.join(tempfile.gettempdir(), "electrico-diag")
os.makedirs(OUT, exist_ok=True)

PARKS = [("room", 0.61), ("frame", 0.45), ("building", 0.29), ("current", 0.93), ("wiring", 0.77)]
TIERS = ["full", "reduced", "minimal"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=[
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--disable-background-timer-throttling", "--ignore-gpu-blocklist",
    ])
    for tier in TIERS:
        errors = []
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m, e=errors: e.append(m.text[:140]) if m.type == "error" else None)
        page.on("pageerror", lambda ex, e=errors: e.append("PAGEERR: " + str(ex)[:140]))
        t0 = time.time()
        page.goto(f"{BASE}/?tier={tier}", wait_until="domcontentloaded")
        page.bring_to_front()
        load_ms = None
        for _ in range(120):
            lp = page.evaluate("() => window.__experience ? window.__experience.getState().loadProgress : 0")
            if lp >= 1:
                load_ms = int((time.time() - t0) * 1000); break
            page.wait_for_timeout(250)
        q = page.evaluate("() => window.__experience ? window.__experience.getState().quality : '?'")
        # Wait until Lenis has a real scroll limit (right after load it can be 0,
        # so the first scrollTo(t*limit) lands at the hero).
        for _ in range(40):
            lim = page.evaluate("() => window.__lenis ? window.__lenis.limit : 0")
            if lim and lim > 100:
                break
            page.wait_for_timeout(150)
        page.wait_for_timeout(1500)
        for name, t in PARKS:
            page.evaluate("(t)=>{const l=window.__lenis; l.scrollTo(t*l.limit,{immediate:true});}", t)
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(OUT, f"{tier}-{name}.png"))
        print(f"TIER {tier}: quality={q} load_ms={load_ms} errors={len(errors)}")
        if errors:
            print("  ", json.dumps(errors[:8]))
        page.close()
    browser.close()
