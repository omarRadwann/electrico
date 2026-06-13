"""Pinpoint the circular-JSON crash. Wrap JSON.stringify before load, record the
offending object's shape + a JS stack at the catch, return a safe stub so the app
survives. Mirror the capture interaction (bring_to_front, health rAF, scroll sweep)
so we trigger the same condition."""
import json, os
from playwright.sync_api import sync_playwright

PORT = os.environ.get("ELECTRICO_PORT", "3013")
URL = f"http://localhost:{PORT}"

INIT = r"""
(() => {
  const orig = JSON.stringify;
  window.__circ = [];
  JSON.stringify = function (v, ...rest) {
    try { return orig.call(JSON, v, ...rest); }
    catch (e) {
      if (String(e).includes('circular')) {
        const rec = { topType: v && v.constructor && v.constructor.name, keys: {},
                      stack: (new Error().stack || '').split('\n').slice(1,6).join(' | ') };
        try { for (const k of Object.keys(v)) { const val = v[k];
          rec.keys[k] = (val===null?'null':(val&&val.constructor?val.constructor.name:typeof val))
            + (val&&val.isObject3D?' [O3D]':'') + (val&&val.isMaterial?' [MAT]':'')
            + (val&&val.isBufferGeometry?' [GEO]':''); } } catch(e2){ rec.keysErr=String(e2); }
        window.__circ.push(rec);
        return '"__CIRC__"';
      }
      throw e;
    }
  };
})();
"""

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=[
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
        "--disable-background-timer-throttling", "--ignore-gpu-blocklist",
    ])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(INIT)
    page.on("pageerror", lambda e: errors.append(str(e)[:200]))
    page.goto(URL, wait_until="networkidle")
    page.bring_to_front()
    page.wait_for_timeout(3500)
    if page.evaluate("() => !!window.__lenis"):
        for t in [0.0, 0.13, 0.29, 0.34, 0.45, 0.61, 0.68, 0.77, 0.93, 0.96]:
            page.evaluate("(t)=>{const l=window.__lenis; l.scrollTo(t*l.limit,{immediate:true});}", t)
            page.wait_for_timeout(900)
    circ = page.evaluate("() => window.__circ")
    print("CIRCULAR HITS:", json.dumps(circ, indent=2))
    print("PAGEERRORS:", json.dumps([e for e in errors if 'circular' not in e][:10], indent=2))
    print("CIRC COUNT:", len(circ), " ERR COUNT:", len(errors))
    browser.close()
