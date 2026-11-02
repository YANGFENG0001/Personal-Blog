/* Lip sync: sample the mouth fast enough to see per-glyph plateaus.
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/lip.cjs
 * Needs playwright (devDependency of the site).
 *
 * What it asserts, in effect: the mouth parks on a value instead of sweeping
 * through one. A sine would never repeat between 20ms samples; glyph-driven
 * motion repeats on every vowel. `plateauRatio` well above 0.5 plus an
 * `openMin/openMax` spread is the pass condition.
 */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1300 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

  await p.goto('http://localhost:4321/lacia', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!document.querySelector('.lr-face[data-face="mouth"]'), null, { timeout: 10000 });

  /* Sample the opening line, which fires on its own ~900ms after hydration.
     Clicking to force a line does not work here: the click lands before
     hydration and is swallowed, which is how the first attempt ended up
     measuring a line that had already finished. */
  const out = await p.evaluate(async () => {
    const read = () => {
      const on = document.querySelector('.lr-face[data-face="mouth"][data-on]');
      if (!on) return null;
      const m = getComputedStyle(on).transform;
      if (!m || m === 'none') return { sx: 1, sy: 1 };
      const n = m.match(/-?[\d.]+/g).map(Number);
      return { sx: +Math.hypot(n[0], n[1]).toFixed(3), sy: +Math.hypot(n[2], n[3]).toFixed(3) };
    };
    const t0 = performance.now();
    const samples = [];
    for (let i = 0; i < 130; i++) {
      const r = read();
      samples.push([Math.round(performance.now() - t0), r.sx, r.sy]);
      await new Promise((res) => setTimeout(res, 20));
    }
    return {
      samples,
      glyphs: Array.from(document.querySelectorAll('.ls-jp .ls-ch')).map((e) => e.textContent),
    };
  });

  const sy = out.samples.map((s) => s[2]);
  const sx = out.samples.map((s) => s[1]);
  // A sine would never repeat between 20ms samples; glyph-driven motion parks
  // on each vowel until the next glyph lands.
  let repeats = 0;
  for (let i = 1; i < sy.length; i++) if (Math.abs(sy[i] - sy[i - 1]) < 0.02) repeats++;

  // Speech window only: from the first sample above 1.02 to the last.
  const first = sy.findIndex((v) => v > 1.02);
  const last = sy.length - 1 - [...sy].reverse().findIndex((v) => v > 1.02);
  const win = sy.slice(first, last + 1);
  const winX = sx.slice(first, last + 1);

  console.log(
    JSON.stringify(
      {
        glyphs: out.glyphs.join(''),
        glyphCount: out.glyphs.length,
        speech: {
          from: out.samples[first]?.[0],
          to: out.samples[last]?.[0],
          openMin: Math.min(...win),
          openMax: Math.max(...win),
          wideMin: Math.min(...winX),
          wideMax: Math.max(...winX),
        },
        headPop: sy.slice(0, 6),
        distinctLevels: new Set(sy.map((v) => v.toFixed(2))).size,
        plateauRatio: +(repeats / (sy.length - 1)).toFixed(2),
        errs,
      },
      null,
      2
    )
  );
  console.log(out.samples.map(([t, a, c]) => `${t}\t${a}\t${c}`).join('\n'));

  await b.close();
})();
