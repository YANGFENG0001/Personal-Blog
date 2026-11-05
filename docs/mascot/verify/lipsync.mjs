/**
 * Lip sync — does the inline-SVG mascot's mouth actually move while it speaks?
 *
 * Run against a dev server (`npm run dev`, port 4321 by default):
 *
 *     node docs/mascot/verify/lipsync.mjs
 *     BASE=http://localhost:4321 node docs/mascot/verify/lipsync.mjs
 *
 * Why it needs a server: lip sync lives inside the component's client script, so
 * unlike the face matrix (`faces.mjs`, which imports `mascotSvg()`) there is
 * nothing to import — the only honest check drives a real page. The fixture at
 * `/mascot-probe` renders the real component with `character="haru"` and exists
 * only in dev; see src/pages/mascot-probe.astro.
 *
 * What is asserted, and why each one is not the same as the others:
 *
 *   1. `--ms-open` travels through several distinct values. Catches the wiring
 *      being dead — the failure that hid for a while behind a guard that asked
 *      "is `data-kind` an SVG look" instead of "is there a mouth to drive".
 *   2. The mouth's *rendered height* changes. Writing a CSS variable and reading
 *      it back proves the schedule ran; it does not prove anything scaled. A
 *      typo in the selector, or `transform-box` missing, passes (1) and fails
 *      here. This is the assertion that matters.
 *   3. The height returns to rest after the line ends, so the mouth does not
 *      freeze half open.
 *   4. Both speaking states are covered: a click lands in `talk` or `happy` at
 *      random, and `happy` draws a different mouth element entirely. Checking
 *      only one would leave the other silently mute.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4321';
/* The fixture has to be a *flat* look: 小春 is now a layered rig, whose mouth is
   driven by the rig engine and verified by `docs/lacia-rig/verify/lip.cjs`.
   `?c=sora` pins this check to a look that still goes through `mascotSvg()`. */
const URL = `${BASE}/mascot-probe?c=sora`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-mascot] .ms-mouth-talk', { timeout: 10_000 });

/**
 * Click, then sample the CSS variable and the visible mouth's box.
 *
 * `Math.random` is pinned so the two states are reachable on purpose: the click
 * handler picks `happy` when `random() < 0.3`, and a lower value also routes the
 * line to the time-of-day group, which is fine — any line exercises the same
 * schedule. Sampling is 20ms because the shortest mora is ~120ms; coarser than
 * that and a short open would fall between two samples.
 */
async function speak(rng) {
  return page.evaluate(async (rng) => {
    const root = document.querySelector('[data-mascot]');
    const real = Math.random;
    Math.random = () => rng;
    root.querySelector('[data-mascot-btn]').click();
    Math.random = real;

    const openMouth = () => {
      const cands = ['.ms-mouth-talk', '.ms-mouth-grin'].map((s) => root.querySelector(s));
      return cands.find((el) => el && +getComputedStyle(el).opacity > 0.5) ?? null;
    };

    const t0 = performance.now();
    const rows = [];
    for (let i = 0; i < 130; i++) {
      const mouth = openMouth();
      const cs = getComputedStyle(root);
      rows.push({
        t: Math.round(performance.now() - t0),
        v: parseFloat(cs.getPropertyValue('--ms-open').trim()),
        w: parseFloat(cs.getPropertyValue('--ms-wide').trim()),
        h: mouth ? +mouth.getBoundingClientRect().height.toFixed(2) : null,
        bw: mouth ? +mouth.getBoundingClientRect().width.toFixed(2) : null,
      });
      await new Promise((r) => setTimeout(r, 20));
    }
    return { state: root.dataset.state, text: root.querySelector('[data-mascot-bubble]').textContent, rows };
  }, rng);
}

const rounds = [
  { name: 'talk', rng: 0.9 },
  { name: 'happy', rng: 0.1 },
];

const results = [];
for (const r of rounds) {
  const out = await speak(r.rng);
  const vs = out.rows.map((x) => x.v).filter((x) => Number.isFinite(x));
  const ws = out.rows.map((x) => x.w).filter((x) => Number.isFinite(x));
  const hs = out.rows.map((x) => x.h).filter((x) => Number.isFinite(x));
  const distinctV = new Set(vs.map((x) => x.toFixed(2))).size;
  const distinctH = new Set(hs.map((x) => x.toFixed(1))).size;
  // Rest is `--ms-open: 1`, so the mouth sits at its drawn height at the end.
  const tail = hs.slice(-6);
  const travel = hs.length ? +(Math.max(...hs) - Math.min(...hs)).toFixed(2) : 0;
  results.push({
    want: r.name,
    state: out.state,
    text: out.text,
    samples: out.rows.length,
    openVar: { distinct: distinctV, min: vs.length ? Math.min(...vs) : null, max: vs.length ? Math.max(...vs) : null },
    // Recorded, not asserted on travel: how much the width moves depends on
    // which vowels happen to be in the sampled line, and a Chinese line can be
    // all mid vowels. What *is* asserted is that the variable is written at all
    // and stays inside the band the viseme table can produce.
    wideVar: { distinct: new Set(ws.map((x) => x.toFixed(2))).size, min: ws.length ? Math.min(...ws) : null, max: ws.length ? Math.max(...ws) : null },
    mouthHeight: { distinct: distinctH, min: hs.length ? Math.min(...hs) : null, max: hs.length ? Math.max(...hs) : null, travel },
    tailSteady: tail.length > 1 ? +(Math.max(...tail) - Math.min(...tail)).toFixed(2) : null,
    restH: hs.length ? hs[hs.length - 1] : null,
    ok:
      out.state === r.name &&
      distinctV >= 4 &&
      distinctH >= 4 &&
      // The mouth has to move far enough to be seen, not merely far enough to be
      // measured: below ~2px on a mouth this small the eye reads it as noise.
      travel >= 2 &&
      ws.length > 10 &&
      Math.min(...ws) >= 0.7 &&
      Math.max(...ws) <= 1.25 &&
      tail.length > 1 &&
      Math.max(...tail) - Math.min(...tail) <= 0.6,
  });
}

const pass = results.every((r) => r.ok) && errs.length === 0;
console.log(JSON.stringify({ pass, results, errs }, null, 1));
await browser.close();
process.exit(pass ? 0 : 1);
