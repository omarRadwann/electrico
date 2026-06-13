"""Confirm the retuned audio graph builds without error on LIVE: click the sound
toggle (the autoplay gesture), let it run, and report any console/page errors."""
import os
from playwright.sync_api import sync_playwright

URL = "https://omarradwann.github.io/electrico/"
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=[
        "--disable-renderer-backgrounding", "--autoplay-policy=no-user-gesture-required",
        "--ignore-gpu-blocklist",
    ])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("PAGEERR: " + str(e)[:160]))
    page.goto(URL, wait_until="domcontentloaded")
    page.bring_to_front()
    page.wait_for_timeout(11000)
    # The sound toggle (.hud-sound) — click it to build + start the audio graph.
    try:
        page.click(".hud-sound", timeout=4000)
        clicked = True
    except Exception as e:
        clicked = False
        errors.append("CLICK FAIL: " + str(e)[:80])
    page.wait_for_timeout(2500)
    # A few wheel flicks (exercise the velocity-wind path that used to fan).
    for _ in range(8):
        page.mouse.wheel(0, 700)
        page.wait_for_timeout(90)
    page.wait_for_timeout(2000)
    print("toggle clicked:", clicked)
    print("ERRORS:", errors[:12], "COUNT:", len(errors))
    browser.close()
