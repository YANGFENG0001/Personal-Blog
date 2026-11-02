/* Linkage: does the device actually move with her, or is it scenery?
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/linkage.cjs
 *
 * "Not stiff" is three separate claims and each one can fail on its own, so
 * each gets its own measurement:
 *
 *   1. AIM      — the turret term. Moving the pointer across the stage must
 *                 swing the device, and letting go must let it settle back.
 *   2. SOCKET   — a jolt through her body must reach the device. `poke` is a
 *                 click on her; the device is socketed to her waist, so it has
 *                 to take the hit too and then recover.
 *   3. FOLLOW   — a form switch changes her stance, and the device has to
 *                 arrive at its new angle over time rather than teleport.
 *
 * ## Why this samples from inside the page
 *
 * A node-side loop of `evaluate` calls is the obvious implementation and it
 * lies: each round trip costs 8–20ms, so a "50ms" interval lands at 60–75ms and
 * steps straight over the peak of a 180ms impulse. `requestAnimationFrame`
 * inside the page samples every frame the browser actually paints.
 *
 * ## Why there is a control trace
 *
 * The device is never still — idle roll, aim, and the page's own auto form
 * cycling (every 6–8s while she is idle) all move it. Without a control, "did
 * the poke move it" is a coin flip on where the idle phase happened to be. The
 * control also has to be *clean*: if the auto-cycler switched forms mid-trace,
 * the amplitude it reports is a form change, not idle motion, so the trace is
 * retried.
 *
 * ## Why the form is reset before the follow test
 *
 * `setForm` returns early when the form is already current, so a test that just
 * clicks "轨道炮" measures nothing whenever the auto-cycler got there first —
 * which it does roughly one run in three.
 *
 * ## If it goes red
 *
 * The page cycles forms on its own, so a run can collide with a switch that
 * lands inside a measurement window. Observed rate: 1 in ~8. Re-run before
 * touching anything; if it fails twice in a row, it is a real regression. Do
 * not widen the thresholds to make it green — they were set from measured
 * margins (swing 2.0–2.6° against a 1.2° floor, jerk 0.8–0.97 against 0.06–0.11
 * idle), and the idle motion is the thing they have to stay above.
 */
const { chromium } = require('playwright');

const PORT = process.env.PORT || 4321;
const URL = `http://localhost:${PORT}/lacia`;
const STAGE = '.lr[data-variant="stage"]';
const MON = `${STAGE} .lr-monolith`;

/** Installed once: sample the device rotation every frame for `ms`. */
const SAMPLER = `
  window.__monTrace = (ms) => new Promise((res) => {
    const el = document.querySelector('${MON}');
    const deg = () => {
      const m = getComputedStyle(el).transform;
      if (!m || m === 'none') return 0;
      const p = m.match(/matrix\\(([^)]+)\\)/);
      if (!p) return 0;
      const [a, b] = p[1].split(',').map(Number);
      return +(((Math.atan2(b, a) * 180) / Math.PI).toFixed(2));
    };
    const out = [];
    const t0 = performance.now();
    const form0 = el.dataset.form;
    const tick = (now) => {
      out.push({ t: Math.round(now - t0), d: deg() });
      if (now - t0 < ms) requestAnimationFrame(tick);
      else res({ trace: out, form0, form1: el.dataset.form });
    };
    requestAnimationFrame(tick);
  });
  window.__pickForm = (name) => {
    const b = [...document.querySelectorAll('.ls-console button')].find((x) => x.textContent.includes(name));
    if (!b) return false;
    b.click();
    return true;
  };
  window.__monForm = () => document.querySelector('${MON}').dataset.form;
`;

const run = (p, ms) => p.evaluate((n) => window.__monTrace(n), ms);
const pick = (p, name) => p.evaluate((n) => window.__pickForm(n), name);

/** Distinct values after collapsing samples closer than `eps` degrees.
 *  Takes numbers, not trace samples: passing samples here made every comparison
 *  `Math.abs(undefined - undefined)`, which is NaN, which is never ≥ eps — so
 *  the count came back as 1 for every trace and the test "passed" the animation
 *  claim for a device that had not moved at all. */
const steps = (vals, eps = 0.15) =>
  vals.reduce((acc, v) => (acc.length === 0 || Math.abs(v - acc[acc.length - 1]) >= eps ? [...acc, v] : acc), []);

/** Largest frame-to-frame change, in degrees, over the samples in `[from, to]`.
 *  Idle motion is slow and smooth; an impulse is fast. Amplitude alone cannot
 *  tell them apart — the device's idle swing is ~1.3° and a poke is ~2°, which
 *  is not a margin anyone should trust — but the *rate* differs by 4–8×, so
 *  that is what gets asserted. Pass `from` to isolate a window (e.g. the tail,
 *  to check the impulse died). */
const jerk = (trace, from = 0, to = 500) => {
  const seg = trace.filter((s) => s.t >= from && s.t <= to);
  return seg.reduce((m, s, i) => (i === 0 ? 0 : Math.max(m, Math.abs(s.d - seg[i - 1].d))), 0);
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector(MON);
  await p.addScriptTag({ content: SAMPLER });
  /* Her opening line runs ~900ms after hydration; anything dispatched during it
     is swallowed by the scripted state. */
  await p.waitForTimeout(3400);

  /* Park the pointer in the middle before the baseline. Measuring it first,
     with the pointer wherever it happened to start, compares two different
     pointer positions and calls the difference "drift". */
  await p.mouse.move(720, 500);
  await p.waitForTimeout(800);
  const base = (await run(p, 300)).trace.at(-1).d;

  /* ── 1. aim ─────────────────────────────────────────────────────────── */
  await p.mouse.move(160, 520);
  await p.waitForTimeout(420);
  const aimL = (await run(p, 200)).trace.at(-1).d;
  await p.mouse.move(1320, 520);
  await p.waitForTimeout(420);
  const aimR = (await run(p, 200)).trace.at(-1).d;
  await p.mouse.move(720, 500);
  await p.waitForTimeout(700);
  const aimBack = (await run(p, 200)).trace.at(-1).d;

  const aim = {
    base: +base.toFixed(2),
    left: +aimL.toFixed(2),
    right: +aimR.toFixed(2),
    swing: +Math.abs(aimR - aimL).toFixed(2),
    back: +aimBack.toFixed(2),
    drift: +Math.abs(aimBack - base).toFixed(2),
  };

  /* ── 2. socket ──────────────────────────────────────────────────────── */
  let idle = null;
  for (let i = 0; i < 3 && !idle; i++) {
    const c = await run(p, 1600);
    if (c.form0 === c.form1) {
      const ds = c.trace.map((s) => s.d);
      idle = { amp: +(Math.max(...ds) - Math.min(...ds)).toFixed(2), jerk: +jerk(c.trace).toFixed(2), form: c.form0 };
    }
  }
  if (!idle) idle = { amp: 0.8, jerk: 0.1, form: 'unknown' };

  /* Warm-up poke, not measured. It pulls her out of `idle`, which is the only
     state the auto form cycler runs in — otherwise the cycler can fire inside
     the measured window and the "jolt" being measured is a form switch. */
  await p.evaluate((stage) => {
    const scope = document.querySelector(stage);
    (scope.closest('[data-mascot]') ?? scope).dispatchEvent(new CustomEvent('lacia:poke'));
  }, STAGE);
  await p.waitForTimeout(1900);

  const poke = await p.evaluate(
    (stage) =>
      new Promise((res) => {
        const scope = document.querySelector(stage);
        const el = scope.querySelector('.lr-monolith');
        const deg = () => {
          const m = getComputedStyle(el).transform;
          const q = m.match(/matrix\(([^)]+)\)/);
          const [a, bb] = q[1].split(',').map(Number);
          return +((Math.atan2(bb, a) * 180) / Math.PI).toFixed(2);
        };
        const out = [];
        const t0 = performance.now();
        const form0 = el.dataset.form;
        (scope.closest('[data-mascot]') ?? scope).dispatchEvent(new CustomEvent('lacia:poke'));
        const tick = (now) => {
          out.push({ t: Math.round(now - t0), d: deg() });
          if (now - t0 < 1600) requestAnimationFrame(tick);
          else res({ trace: out, form0, form1: el.dataset.form });
        };
        requestAnimationFrame(tick);
      }),
    STAGE,
  );
  const before = poke.trace[0].d;
  const peak = poke.trace.reduce((m, s) => (Math.abs(s.d - before) > Math.abs(m.d - before) ? s : m), poke.trace[0]);
  const socket = {
    idleAmp: idle.amp,
    idleJerk: idle.jerk,
    jerk: +jerk(poke.trace).toFixed(2),
    tailJerk: +jerk(poke.trace, 1100, 1600).toFixed(2),
    before,
    peak: peak.d,
    at: peak.t,
    kick: +Math.abs(peak.d - before).toFixed(2),
    formStable: poke.form0 === poke.form1,
  };

  /* ── 3. follow ──────────────────────────────────────────────────────── */
  await pick(p, '收束');
  await p.waitForTimeout(1800);
  const fromForm = await p.evaluate(() => window.__monForm());

  await pick(p, '轨道炮');
  const followRaw = await run(p, 1400);
  const followSteps = steps(followRaw.trace.map((s) => s.d));
  const follow = {
    fromForm,
    toForm: followRaw.form1,
    from: followRaw.trace[0].d,
    to: followRaw.trace.at(-1).d,
    delta: +(followRaw.trace.at(-1).d - followRaw.trace[0].d).toFixed(2),
    steps: followSteps.length,
    frames: followRaw.trace.length,
  };

  /* The drift figure is reported but not asserted: `monAim` also follows her
     idle look-around, so the device keeps moving after the pointer returns and
     an absolute "back where it started" check fails for the wrong reason. What
     is asserted instead is that the pointer's left/right maps to the device's
     left/right — a direction check, which no amount of idle drift can flip. */
  const pass =
    aim.swing >= 1.2 &&
    aim.right > aim.left &&
    socket.jerk >= socket.idleJerk * 2.5 &&
    socket.tailJerk <= socket.idleJerk * 2.5 &&
    socket.formStable &&
    follow.fromForm === 'coffin' &&
    follow.toForm === 'railgun' &&
    follow.steps >= 3 &&
    errs.length === 0;

  console.log(JSON.stringify({ aim, socket, follow, pass, errs }, null, 1));
  await b.close();
  process.exit(pass ? 0 : 1);
})();
