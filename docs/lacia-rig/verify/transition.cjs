/* Transitions: is the form switch actually *moving*, or just landing?
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/transition.cjs
 *
 * This covers the CSS half of the mechanism (the springs are `linkage.cjs`).
 * Three groups carry the choreography and each one can silently stop
 * interpolating:
 *
 *   unfold → `.lr-s1` slab angle        (rotate + stagger)
 *   railgun → `.lr-half-r` shell split  (single-sided door)
 *   shield → `.lr-h1` hex scale         (fly out of the hub)
 *
 * A before/after screenshot cannot tell a transition from a jump: the end state
 * is identical either way. So each trace is sampled per frame and must contain
 * several distinct intermediate values. The overshoot is reported but not
 * asserted — it is a style choice, and it is easy to write a cubic-bezier whose
 * control point y is 1.06 and get no overshoot at all (peak 1.0006, because the
 * last two control points sit at y = 1 and drag the curve back).
 */
const { chromium } = require('playwright');

const PORT = process.env.PORT || 4321;
const URL = `http://localhost:${PORT}/lacia`;
const STAGE = '.lr[data-variant="stage"]';

/* In-page sampler: per-frame reads, because a node-side loop costs 8–20ms per
   round trip and a 180ms impulse peak falls between two samples. */
const SAMPLER = `
  window.__read = (sel, kind) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    if (kind === 'scale') {
      const m = c.transform.match(/matrix\\(([^)]+)\\)/);
      return m ? +(+m[1].split(',')[0]).toFixed(4) : 1;
    }
    if (kind === 'x') {
      const m = c.transform.match(/matrix\\(([^)]+)\\)/);
      return m ? Math.round(+m[1].split(',')[4]) : 0;
    }
    const m = c.transform.match(/matrix\\(([^)]+)\\)/);
    if (!m) return 0;
    const [a, b] = m[1].split(',').map(Number);
    return +(((Math.atan2(b, a) * 180) / Math.PI).toFixed(1));
  };
  window.__trace = (form, sel, kind, ms) =>
    new Promise((res) => {
      [...document.querySelectorAll('.ls-console button')].find((x) => x.textContent.includes(form))?.click();
      const out = [];
      const t0 = performance.now();
      const tick = (now) => {
        out.push({ t: Math.round(now - t0), v: window.__read(sel, kind) });
        if (now - t0 < ms) requestAnimationFrame(tick);
        else res(out);
      };
      requestAnimationFrame(tick);
    });
`;

const distinct = (trace, eps) =>
  trace.reduce((acc, s) => (acc.length === 0 || Math.abs(s.v - acc[acc.length - 1]) >= eps ? [...acc, s.v] : acc), []);

const CASES = [
  { form: '展开', sel: `${STAGE} .lr-s1`, kind: 'deg', eps: 1, label: 'slab' },
  { form: '轨道炮', sel: `${STAGE} .lr-half-r`, kind: 'x', eps: 1, label: 'split' },
  { form: '障壁', sel: `${STAGE} .lr-h1`, kind: 'scale', eps: 0.01, label: 'hex' },
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector(`${STAGE} .lr-monolith`);
  await p.addScriptTag({ content: SAMPLER });
  await p.waitForTimeout(3400);

  const report = {};
  let pass = true;

  for (const c of CASES) {
    /* Back to the casket first: the page auto-cycles forms every 6–8s while she
       is idle, and clicking the form she is already in is a no-op. */
    await p.evaluate(() => [...document.querySelectorAll('.ls-console button')].find((x) => x.textContent.includes('收束'))?.click());
    await p.waitForTimeout(1500);

    const trace = await p.evaluate(
      ({ form, sel, kind }) => window.__trace(form, sel, kind, 1500),
      { form: c.form, sel: c.sel, kind: c.kind },
    );
    const vals = trace.map((s) => s.v);
    const steps = distinct(trace, c.eps);
    const from = vals[0];
    const to = vals[vals.length - 1];
    /* Overshoot is measured *past the landing point along the direction of
       travel*. Taking the sample farthest from `to` instead returns `from` on a
       monotonic ramp and reports the whole travel as overshoot. */
    const dir = Math.sign(to - from) || 1;
    const beyond = vals.reduce((m, v) => ((v - to) * dir > (m - to) * dir ? v : m), to);

    report[c.label] = {
      form: c.form,
      frames: trace.length,
      from,
      to,
      steps: steps.length,
      overshoot: +((beyond - to) * dir).toFixed(2),
    };
    if (steps.length < 4 || from === to) pass = false;
  }

  pass = pass && errs.length === 0;
  console.log(JSON.stringify({ ...report, pass, errs }, null, 1));
  await b.close();
  process.exit(pass ? 0 : 1);
})();
