/* Does the fan stay inside the plate, and does the plate stay inside the viewport?
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/bleed.cjs
 * Prints one line per viewport: plate width, `--lr-u`, `--lr-mon-k`, the margin
 * from the fan's bounding box to each plate edge, and the page's horizontal
 * overflow (must be 0). Negative T/B values are corners of the rotated bounding
 * box, not real pixels — check a screenshot before "fixing" them.
 */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  for (const w of [1440, 1400, 1200, 1024, 900, 760, 600, 420]) {
    const p = await b.newPage({ viewport: { width: w, height: 1300 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto('http://localhost:4321/lacia', { waitUntil: 'networkidle' });
    await p.waitForTimeout(2300);
    await p.evaluate(() => document.querySelector('nav.ls-console').querySelectorAll('button')[3].click());
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => {
      const plate = document.querySelector('.ls-plate').getBoundingClientRect();
      const rs = [...document.querySelectorAll('.lr-slab')].map((e) => e.getBoundingClientRect());
      const l = Math.min(...rs.map((r) => r.left));
      const r = Math.max(...rs.map((r) => r.right));
      const t = Math.min(...rs.map((r) => r.top));
      const bo = Math.max(...rs.map((r) => r.bottom));
      const lr = document.querySelector('.ls .lr');
      const k = getComputedStyle(lr).getPropertyValue('--lr-mon-k').trim();
      const u = getComputedStyle(document.querySelector('.ls')).getPropertyValue('--lr-u').trim();
      return {
        plateW: Math.round(plate.width),
        plateL: Math.round(plate.left),
        u,
        k,
        L: Math.round(l - plate.left),
        R: Math.round(plate.right - r),
        T: Math.round(t - plate.top),
        B: Math.round(plate.bottom - bo),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    console.log(w, JSON.stringify(m), errs.length ? 'ERRS ' + errs[0] : '');
    await p.close();
  }
  await b.close();
})();
