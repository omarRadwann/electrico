"""Detect scroll hitches (shader-compile stalls). Records rAF frame deltas while
driving a SMOOTH scroll across the whole dive (crossing the Frame ~0.30 and Wiring
~0.69 gate boundaries). A first-use compile stall shows as a single huge frame
delta (100-500ms). Reports the worst deltas + where (progress) they happened."""
import json, os, time
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
BASE = f"http://localhost:{PORT}"

REC = r"""
(() => {
  window.__frames = [];
  let last = performance.now();
  function tick(){
    const now = performance.now();
    const dt = now - last; last = now;
    const p = window.__experience ? window.__experience.getState().progress : -1;
    window.__frames.push([Math.round(dt), +p.toFixed(3)]);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
"""

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
        page.wait_for_timeout(2500)  # let Preload's compile finish under the loader
        page.evaluate("()=>window.__experience.getState().setCompletedOnce(true)")
        page.evaluate(REC)
        # Smoothly scroll 0.02 -> 0.97 in ~40 steps (crosses every boundary like a real scroll)
        steps = 48
        for k in range(steps + 1):
            target = 0.02 + (0.95 * k / steps)
            page.evaluate("(t)=>{const l=window.__lenis; l.scrollTo(t*l.limit,{duration:0.25});}", target)
            page.wait_for_timeout(160)
        frames = page.evaluate("()=>window.__frames")
        # ignore the first 30 frames (settle); find stalls > 60ms
        body = frames[30:]
        stalls = sorted([f for f in body if f[0] > 60], key=lambda x: -x[0])[:8]
        avg = round(sum(f[0] for f in body) / max(1, len(body)), 1)
        worst = max((f[0] for f in body), default=0)
        print(f"TIER {tier}: frames={len(body)} avg_dt={avg}ms worst={worst}ms stalls>60ms={len(stalls)}")
        print("  worst stalls [dt_ms, progress]:", json.dumps(stalls))
        page.close()
    browser.close()
