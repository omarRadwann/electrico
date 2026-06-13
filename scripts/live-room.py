"""Capture the Room on the LIVE site via window.scrollTo fractions (Lenis syncs to
native scroll on prod). Sweeps fractions to catch the Room dimension + its sofa."""
import os, tempfile
from playwright.sync_api import sync_playwright

URL = "https://omarradwann.github.io/electrico/"
OUT = os.path.join(tempfile.gettempdir(), "electrico-live")
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=[
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--disable-background-timer-throttling", "--ignore-gpu-blocklist",
    ])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(m.text[:140]) if m.type == "error" else None)
    page.goto(URL, wait_until="domcontentloaded")
    page.bring_to_front()
    page.wait_for_timeout(11000)
    for frac in [0.555, 0.57, 0.585, 0.60]:
        page.evaluate("(f)=>window.scrollTo(0, document.body.scrollHeight*f)", frac)
        page.wait_for_timeout(2600)
        page.screenshot(path=os.path.join(OUT, f"room-{int(frac*100)}.png"))
        print(f"room-{int(frac*100)}")
    print("ERRORS:", len(errors), errors[:6])
    browser.close()
