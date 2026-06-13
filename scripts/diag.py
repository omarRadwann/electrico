"""Comprehensive per-tier park capture. Loads fresh per tier via ?tier=, sets
completedOnce (so jump-nav isn't reset by the wrap guard), captures all SIX parks
with a double-scroll + settle. For diagnosing scene-bleed + per-tier lookdev."""
import json, os, tempfile, time
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
BASE = f"http://localhost:{PORT}"
OUT = os.path.join(tempfile.gettempdir(), "electrico-diag")
os.makedirs(OUT, exist_ok=True)

PARKS = [("city", 0.13), ("building", 0.29), ("frame", 0.45),
         ("room", 0.61), ("wiring", 0.77), ("current", 0.93)]
TIERS = ["reduced", "full"]

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
        for _ in range(120):
            if page.evaluate("()=>window.__experience&&window.__experience.getState().loadProgress>=1"):
                break
            page.wait_for_timeout(250)
        load_ms = int((time.time() - t0) * 1000)
        page.wait_for_timeout(2000)
        page.evaluate("()=>window.__experience&&window.__experience.getState().setCompletedOnce(true)")
        for name, t in PARKS:
            for _ in range(2):
                page.evaluate("(t)=>{const l=window.__lenis; l.scrollTo(t*l.limit,{immediate:true});}", t)
                page.wait_for_timeout(850)
            page.screenshot(path=os.path.join(OUT, f"all-{tier}-{name}.png"))
        q = page.evaluate("()=>window.__experience.getState().quality")
        print(f"TIER {tier}: q={q} load_ms={load_ms} errors={len(errors)} {json.dumps(errors[:5])}")
        page.close()
    browser.close()
