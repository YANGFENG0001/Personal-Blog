/* Secondary motion: does the *upper* body have mass, or is it a printed shirt?
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/secondary.cjs
 *
 * `joints.cjs` covers the limbs. This covers the chain that has no joints in
 * the art but still has to move: hips → spine → chest → bust → neck → head.
 * Those five links are where "僵硬" actually lives once the arms and legs are
 * done, because a figure whose limbs move and whose torso does not reads as a
 * mannequin being waved around.
 *
 * Four independent judgements, each of which can be red while the others are
 * green:
 *
 *   1. RANGE   — every link moves, and by enough to be seen at display size.
 *                A tenth of a degree is not "subtle", it is absent.
 *   2. LAG     — the bust must trail the chest. If the peak of the torso/chest
 *                cross-correlation is at lag 0, they are one rigid object and
 *                the spring in between is decoration.
 *   3. GAIN    — the bust must be *partially* coupled. A peak correlation of
 *                1.0 means `chest × k` with no spring, which is the same
 *                object drawn twice.
 *   4. FLOAT   — the neck has to translate, not only rotate. Rotation alone
 *                swings the head on an arc and still reads as a stick.
 *   5. HEAD    — the head must be calmer than the pelvis in world space. If it
 *                rides the hips, nothing in the chain is stabilising anything.
 *
 * ## Why the translation is read from the matrix
 *
 * `matrix(a, b, c, d, e, f)` — `e` and `f` are the translation in the element's
 * parent frame. `getComputedStyle` gives the *composed* matrix, so `e` includes
 * the ancestors' offsets; subtracting the series mean leaves the dynamic part,
 * which is the only part this test is about.
 *
 * ## Why 20 s
 *
 * The slowest term in the chain is `weight` at 24 s, so no window is a whole
 * cycle. 20 s is enough for the 12 s sway and the 3.7 s breath to both repeat,
 * which is what the lag estimate needs; it is not enough to see the weight
 * beat, and it does not need to.
 */

const { chromium } = require('playwright');

const PAGE = process.env.LACIA_URL || 'http://localhost:4321/lacia';
const SAMPLE_MS = 20000;

/** Rotation (deg, world) and translation (px, *local*) of a bone.
 *
 *  The angle comes from the composed matrix because that is what the browser
 *  drew. The translation comes from the element's own inline transform string
 *  instead: `getComputedStyle` composes the ancestors in, so a neck read that
 *  way would carry the pelvis's 2.3 px drift and pass this test even if the
 *  neck itself never moved. */
const READ = `
  (el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const local = new DOMMatrix(el.style.transform || 'none');
    return [Math.atan2(m.b, m.a) * 180 / Math.PI, local.e, local.f];
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

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

function corr(a, b) {
  const n = Math.min(a.length, b.length);
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
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

/** Best lag (in frames) and the correlation there.
 *
 *  Convention: `corr(a[i + lag], b[i])`, so a **negative** lag means `b` trails
 *  `a`. That is the opposite of the way it reads, and it is written down here
 *  because getting it backwards turns a correct lag into a red test. */
function bestLag(a, b, maxLag) {
  let best = { lag: 0, r: -Infinity };
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const n = Math.min(a.length, b.length) - Math.abs(lag);
    if (n < 60) continue;
    const aa = a.slice(Math.max(0, lag), Math.max(0, lag) + n);
    const bb = b.slice(Math.max(0, -lag), Math.max(0, -lag) + n);
    const r = corr(aa, bb);
    if (r > best.r) best = { lag, r };
  }
  return best;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'off'));
  /* Pin the form: a form switch changes every pose offset at once, and a trace
     that spans one reports "range" for links that are still, plus a lag of 0
     because the offsets all step together. Same reason as joints.cjs. */
  /* A rig with no device has no console — and nothing to pin: the form cycler
     only exists because there are forms. Clicking is the only public way to
     reach setAutoForms(false), so it is conditional rather than unconditional. */
  if (await page.$('.ls-console button')) {
    await page.click('.ls-console button:first-of-type');
    await page.waitForTimeout(1600);
  }

  const trace = await page.evaluate(
    ({ ms, read }) => {
      const readBone = eval(read);
      const bones = ['hips', 'spine', 'chest', 'torso', 'neck', 'head', 'wristR', 'wristL'];
      const els = {};
      for (const b of bones) els[b] = document.querySelector(`[data-bone="${b}"]`);
      const missing = bones.filter((b) => !els[b]);
      const out = { missing, ang: {}, dx: {}, dy: {} };
      for (const b of bones) if (els[b]) {
        out.ang[b] = [];
        out.dx[b] = [];
        out.dy[b] = [];
      }

      return new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
          for (const b of bones) {
            if (!els[b]) continue;
            const [a, e, f] = readBone(els[b]);
            out.ang[b].push(a);
            out.dx[b].push(e);
            out.dy[b].push(f);
          }
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
  const A = trace.ang;
  if (trace.missing.length) errs.push(`missing bones: ${trace.missing.join(', ')}`);

  /* Translation is composed with the ancestors, so the absolute value carries
     the pose offset and the parents' offsets. Only the *variation* is
     meaningful here. */
  const dyn = (key, bone) => {
    const arr = trace[key][bone] ?? [];
    const m = arr.length ? mean(arr) : 0;
    return arr.map((v) => v - m);
  };

  const report = {
    frames: A.hips?.length ?? 0,
    range: {},
    lag: {},
    corr: {},
    float: {},
    pass: false,
    errs,
  };

  for (const [b, a] of Object.entries(A)) report.range[b] = +range(a).toFixed(2);

  /* 1. Every link moves, by an amount that survives a ~0.3 display scale.
        Floors are per link: a head that swings as far as a waist is a nodding
        doll, so they are set from what each link can carry without looking
        broken, not from one shared number. */
  const FLOOR = { hips: 0.4, spine: 0.8, chest: 1.0, torso: 0.5, neck: 1.0, head: 1.2, wristR: 1.0, wristL: 1.0 };
  for (const [b, f] of Object.entries(FLOOR)) {
    if (report.range[b] !== undefined && report.range[b] < f)
      errs.push(`${b} barely moves: ${report.range[b]}° < ${f}°`);
  }

  /* 2 & 3. The bust follows the chest, late and partially.
        `bestLag(chest, torso)` maximises correlation over an offset; if the
        offset is 0 the two links are welded, and if the peak correlation is
        ~1.0 the bust is just `chest × k` with no spring in between. Both are
        reported because they are different failures: welded is a rig bug, a
        gain of 1 is a modelling bug. */
  const chest = A.chest ?? [];
  const torso = A.torso ?? [];
  const lag = bestLag(chest, torso, 45);
  report.lag.bustVsChest = lag.lag;
  report.corr.bustAtPeak = +lag.r.toFixed(3);
  report.corr.bustAtZero = +corr(chest, torso).toFixed(3);
  if (lag.lag >= -1)
    errs.push(`the bust does not trail the chest: peak correlation at lag ${lag.lag} (needs ≤ -2 frames)`);
  if (report.corr.bustAtPeak > 0.97)
    errs.push(`the bust is welded to the chest: r=${report.corr.bustAtPeak} at its best lag`);

  /* 4. The neck has to translate. Rotation is not enough — a head that only
        pivots on the neck still reads as mounted on a stick. */
  const nx = dyn('dx', 'neck');
  const ny = dyn('dy', 'neck');
  report.float.neckX = +range(nx).toFixed(2);
  report.float.neckY = +range(ny).toFixed(2);
  if (report.float.neckX < 0.8) errs.push(`the neck does not drift sideways: ${report.float.neckX}px < 0.8px`);

  /* Head over hips. Standing still, the head is the calmest thing in the chain
     in *world* space; if it swings as much as the pelvis, nothing is being
     stabilised and the whole figure is one rigid stick. */
  report.corr.headHips = +corr(A.head ?? [], A.hips ?? []).toFixed(3);
  if (report.corr.headHips > 0.85)
    errs.push(`the head rides the hips instead of stabilising: r=${report.corr.headHips}`);

  report.pass = errs.length === 0;
  console.log(JSON.stringify(report, null, 1));
  process.exit(report.pass ? 0 : 1);
})();
