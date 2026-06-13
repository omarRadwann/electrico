"""Focused Room+Current capture with a double-scroll (the first scrollTo right
after load lands on the hero because Lenis' limit/scroll is still settling)."""
import os, tempfile, time
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
BASE = f"http://localhost:{PORT}"
OUT = os.path.join(tempfile.gettempdir(), "electrico-diag")
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=[
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--disable-background-timer-throttling", "--ignore-gpu-blocklist",
    ])
    for tier in ["reduced", "full"]:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(f"{BASE}/?tier={tier}", wait_until="domcontentloaded")
        page.bring_to_front()
        for _ in range(120):
            if page.evaluate("()=>window.__experience&&window.__experience.getState().loadProgress>=1"):
                break
            page.wait_for_timeout(250)
        page.wait_for_timeout(2500)
        # Unlock jump-nav: the backward-wrap guard otherwise resets large forward
        # scrollTo jumps to the hero until the dive is completed once.
        page.evaluate("()=>window.__experience&&window.__experience.getState().setCompletedOnce(true)")
        for name, t in [("frame", 0.45), ("frameexit", 0.55), ("room", 0.61)]:
            # double scroll — first primes, second lands
            for _ in range(2):
                page.evaluate("(t)=>{const l=window.__lenis; l.scrollTo(t*l.limit,{immediate:true});}", t)
                page.wait_for_timeout(900)
            page.screenshot(path=os.path.join(OUT, f"v2-{tier}-{name}.png"))
            print(f"v2-{tier}-{name}")
        page.close()
    browser.close()
