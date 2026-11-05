/* Joints: is every joint actually doing its job, and are the pairs paired?
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/joints.cjs
 *
 * "The limbs are stiff" is not one problem and cannot be fixed by one number.
 * It is at least four, and each one has a measurement that can be red while the
 * others are green:
 *
 *   1. RANGE      — every bone must move. A joint that holds one angle is a
 *                   hinge on a mannequin, no matter how good the pose is.
 *   2. ANTI-PHASE — the two legs must not be the same curve. This is the one
 *                   that "stiff" almost always means: both legs driven by one
 *                   expression makes the lower body a board.
 *   3. SOLE       — the ankle must cancel most of the shin. If it does not,
 *                   the boot tilts with the shin and she stands on stilts.
 *   4. HAND       — the wrist must counter the forearm, not follow it.
 *
 * ## Why the angle is read from the composed matrix, not from the string
 *
 * `style.transform` is a string (`rotate(-1.23deg)`) whose number of decimals
 * changes with magnitude, so parsing it is a source of flaky tests. `DOMMatrix`
 * gives the rotation back as a number, and it is the number the browser
 * actually used.
 *
 * ## Why the sampling runs inside the page
 *
 * Same reason as linkage.cjs: a node-side `evaluate` loop costs 8–20ms per
 * round trip, which aliases the 0.04–0.13 Hz terms these joints move on. The
 * in-page `requestAnimationFrame` loop samples every painted frame.
 *
 * ## Thresholds
 *
 * Set from measured margins on this art, not from taste. If a run goes red,
 * re-run once (the page's own form cycler can land inside the window); if it
 * fails twice, it is a regression. Do not widen them to go green.
 */

const { chromium } = require('playwright');

const PAGE = process.env.LACIA_URL || 'http://localhost:4321/lacia';
const SAMPLE_MS = 12000;

/** Degrees of rotation encoded in a computed transform matrix. */
const READ = `
  (el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return Math.atan2(m.b, m.a) * 180 / Math.PI;
  }
`;

function range(a) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of a) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
}

function corr(a, b) {
  const n = Math.min(a.length, b.length);
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'off'));
  /* Pin the form. The stage cycles through its four forms every 6–8s, and a
     switch moves *every* joint at once (the pose offsets change), so a trace
     that spans one would report a large "range" for joints that are in fact
     still, and a positive wrist/elbow correlation that is really just the two
     offsets moving together. Clicking a form button is the only public way to
     reach `setAutoForms(false)`. */
  /* A rig with no device has no console — and nothing to pin: the form cycler
     only exists because there are forms. Clicking is the only public way to
     reach setAutoForms(false), so it is conditional rather than unconditional. */
  if (await page.$('.ls-console button')) {
    await page.click('.ls-console button:first-of-type');
    await page.waitForTimeout(1600);
  }

  const trace = await page.evaluate(
    ({ ms, read }) => {
      const readAngle = eval(read);
      const bones = ['legR', 'legL', 'kneeR', 'kneeL', 'ankleR', 'ankleL', 'armR', 'armL', 'elbowR', 'elbowL', 'wristR', 'wristL'];
      const els = {};
      for (const b of bones) els[b] = document.querySelector(`[data-bone="${b}"]`);
      const missing = bones.filter((b) => !els[b]);
      /* How many bitmaps each bone actually carries.
       *
       * This is not bookkeeping. A bone rotates whether or not anything hangs
       * off it, so a range read on an empty bone is a green light for a joint
       * that moves nothing — and that is exactly the shape of a rig that looks
       * "fully articulated" while a limb is welded to its parent. The chibi's
       * lower body is one fused layer riding the hips: her legR and kneeR bones
       * spin away all day and drive zero pixels. */
      const parts = {};
      for (const b of bones) parts[b] = els[b] ? els[b].querySelectorAll('img.lr-part').length : 0;
      const out = { missing, parts, series: {} };
      for (const b of bones) if (els[b]) out.series[b] = [];

      return new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          for (const b of bones) if (els[b]) out.series[b].push(readAngle(els[b]));
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      });
    },
    { ms: SAMPLE_MS, read: READ },
  );

  await browser.close();

  const errs = [];
  const S = trace.series;
  if (trace.missing.length) errs.push(`missing bones: ${trace.missing.join(', ')}`);

  const report = { frames: S.legR?.length ?? 0, driven: trace.parts, range: {}, corr: {}, sole: {}, pass: false, errs };

  for (const [b, a] of Object.entries(S)) report.range[b] = +range(a).toFixed(2);

  /* 1. Every joint that carries a part moves. Floors are per joint: a hand
        travels less than a thigh, and demanding the same number from both would
        just mean inflating the hand until it flutters.
        Joints with no part are reported and skipped, not passed. */
  const FLOOR = { legR: 0.6, legL: 0.6, kneeR: 0.8, kneeL: 0.8, ankleR: 0.5, ankleL: 0.5, armR: 0.5, armL: 0.5, elbowR: 0.5, elbowL: 0.5, wristR: 0.5, wristL: 0.5 };
  const idle = Object.entries(trace.parts).filter(([, n]) => n === 0).map(([b]) => b);
  report.noPart = idle;
  for (const [b, f] of Object.entries(FLOOR)) {
    if (idle.includes(b)) continue;
    if (report.range[b] !== undefined && report.range[b] < f) errs.push(`${b} barely moves: ${report.range[b]}° < ${f}°`);
  }

  /* 2. The legs must disagree. Identical curves (r = 1.00) is the board; a
        weak correlation is fine, but it must be clearly below 1. */
  report.corr.legs = +corr(S.legR ?? [], S.legL ?? []).toFixed(3);
  if (!idle.includes('legR') && !idle.includes('legL') && report.corr.legs > 0.9) {
    errs.push(`legs move as one piece: r=${report.corr.legs}`);
  }

  /* 3. Sole level. The boot's world angle is **thigh + shin + ankle** — all
        three bones are nested, so all three contribute. This used to sum only
        the last two, which was close enough while every form stood on the same
        vertical legs and wrong the moment the forms got stances: a 5° stance
        angle is invisible in `knee + ankle` and tilts the sole by the full 5°.
        Measuring the wrong sum is worse than measuring nothing, because it
        reports a green light for the exact case it was written to catch. */
  for (const side of ['R', 'L']) {
    const l = S[`leg${side}`] ?? [];
    const k = S[`knee${side}`] ?? [];
    const a = S[`ankle${side}`] ?? [];
    if ([`leg${side}`, `knee${side}`, `ankle${side}`].some((b) => idle.includes(b))) {
      report.sole[side] = null;
      continue;
    }
    const n = Math.min(l.length, k.length, a.length);
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(l[i] + k[i] + a[i]));
    report.sole[side] = +peak.toFixed(2);
    if (peak > 3.2) errs.push(`ankle${side} does not hold the sole: peak |thigh+shin+ankle| ${peak.toFixed(2)}°`);
  }

  /* 4. The hand counter-rotates the forearm. Positive correlation means the
        hand swings past the forearm like a flag. */
  for (const side of ['R', 'L']) {
    const e = S[`elbow${side}`] ?? [];
    const w = S[`wrist${side}`] ?? [];
    const c = +corr(e, w).toFixed(3);
    report.corr[`wrist${side}`] = c;
    if (idle.includes(`wrist${side}`)) continue;
    if (c > 0.25) errs.push(`wrist${side} follows the forearm instead of hanging: r=${c}`);
  }

  report.pass = errs.length === 0;
  console.log(JSON.stringify(report, null, 1));
  process.exit(report.pass ? 0 : 1);
})();
