/* Expression matrix: every state and every device form must be a distinct face.
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/states.cjs [--shots]
 *
 * What it checks, and why it is not a screenshot test:
 *   - `data-v` on the active brow/mouth layer tells you which *bitmap* is up,
 *     which is the only thing that survives being 9 display px tall. Two states
 *     that differ only in spring offset look identical in a screenshot at this
 *     size but are, in fact, identical faces.
 *   - Every state must own a unique (brow, mouth, blush) triple. The old mapping
 *     gave `sleep` the same face as `idle` — this catches that regression.
 *   - `--shots` also writes `.ref/state-<name>.png`, a face crop per state.
 */
const { chromium } = require('playwright');

/** 换皮肤/角色时传 LACIA_URL，例如 .../lacia?skin=haru。 */
const PAGE = process.env.LACIA_URL || 'http://localhost:4321/lacia';

const STATES = ['idle', 'talk', 'happy', 'held', 'sleep'];
const FORMS = ['coffin', 'railgun', 'shield', 'unfold'];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1300 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

  await p.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!document.querySelector('.lr-face[data-face="mouth"]'), null, { timeout: 10000 });
  /* The stage page types her opening line ~900ms after hydration and ends it
     ~1.5s later. Dispatching a state during that window is useless: the rig is
     mid-script, so it re-picks `open` on the next frame and the read comes back
     labelled `talk`. Wait the line out. */
  await p.waitForTimeout(3200);

  /* Eyelid is read as the max over 300ms, not as a single sample: a blink is
     78ms and lands every 2.6–6.2s, so one sample has a ~1.5% chance of catching
     a closed lid on an awake state and failing the assertion for no reason. */
  const lidMax = () =>
    p.evaluate(async () => {
      const eye = document.querySelector('.lr[data-variant="stage"] img.lr-part[src*="eyewhite-r"]');
      let max = 0;
      for (let i = 0; i < 6; i++) {
        const m = getComputedStyle(eye).transform;
        const n = m === 'none' ? null : m.match(/-?[\d.]+/g).map(Number);
        max = Math.max(max, n ? Math.hypot(n[2], n[3]) : 1);
        await new Promise((r) => setTimeout(r, 55));
      }
      return +max.toFixed(2);
    });

  const read = async () => {
    const r = await p.evaluate(() => {
      const lr = document.querySelector('.lr[data-variant="stage"]');
      const on = (f) => lr.querySelector(`.lr-face[data-face="${f}"][data-on]`)?.dataset.v;
      return {
        brow: on('brow-r'),
        mouth: on('mouth'),
        blush: lr.hasAttribute('data-blush'),
      };
    });
    return { ...r, lid: await lidMax() };
  };

  const setState = async (s) => {
    await p.evaluate((state) => {
      document
        .querySelector('.lr[data-variant="stage"]')
        .dispatchEvent(new CustomEvent('lacia:state', { detail: state }));
    }, s);
    await p.waitForTimeout(520);
  };
  const setForm = async (i) => {
    await p.evaluate((idx) => document.querySelectorAll('nav.ls-console button')[idx].click(), i);
    /* A manual form change also speaks a line, which parks her in `talk` and
       hides the form's own face. Let it finish, then drop back to idle. */
    await p.waitForTimeout(1800);
    await setState('idle');
  };

  const shots = process.argv.includes('--shots');
  /* Recomputed per capture, not once: switching to `unfold` grows the plate and
     moves the figure, so a crop taken at the start lands on her shoulder. */
  const faceClip = () =>
    p.evaluate(() => {
      const r = document.querySelector('.lr-face[data-face="mouth"]').getBoundingClientRect();
      return { x: Math.round(r.x - 46), y: Math.round(r.y - 52), width: Math.round(r.width + 92), height: Math.round(r.height + 72) };
    });

  const rows = [];
  for (const s of STATES) {
    await setState(s);
    rows.push({ kind: 'state', name: s, ...(await read()) });
    if (shots) await p.screenshot({ path: `.ref/state-${s}.png`, clip: await faceClip() });
  }

  /* Forms belong to the device, and the device is an optional component: a
     character with no weapon mounts none, so there is no console to click and
     no form face to check. Skipping the loop is the honest reading — asserting
     four forms on a rig that has none would fail for the wrong reason. */
  const hasDevice = await p.evaluate(() => !!document.querySelector('nav.ls-console button'));
  const forms = [];
  for (let i = 0; hasDevice && i < FORMS.length; i++) {
    await setForm(i);
    forms.push({ kind: 'form', name: FORMS[i], ...(await read()) });
    if (shots) await p.screenshot({ path: `.ref/form-${FORMS[i]}.png`, clip: await faceClip() });
  }

  const fmt = (r) =>
    `${r.name.padEnd(8)} brow=${String(r.brow).padEnd(8)} mouth=${String(r.mouth).padEnd(8)}` +
    ` blush=${r.blush ? 'on ' : 'off'} lid=${r.lid}`;

  console.log('states');
  for (const r of rows) console.log('  ' + fmt(r));
  console.log(hasDevice ? 'forms (after the last state, i.e. idle)' : 'forms — skipped, this rig mounts no device');
  for (const r of forms) console.log('  ' + fmt(r));

  // Uniqueness: a state is "the same face" as another if brow + mouth + blush match.
  const key = (r) => `${r.brow}/${r.mouth}/${r.blush}`;
  const seen = new Map();
  const dupes = [];
  for (const r of rows) {
    if (seen.has(key(r))) dupes.push(`${seen.get(key(r))} == ${r.name}`);
    else seen.set(key(r), r.name);
  }

  // The eyes must be shut for sleep and open for everything else.
  const eyeOk = rows.every((r) => (r.name === 'sleep' ? r.lid < 0.2 : r.lid > 0.9));

  console.log(
    JSON.stringify(
      {
        distinctStates: seen.size,
        ofStates: rows.length,
        duplicates: dupes,
        eyeOk,
        pass: dupes.length === 0 && eyeOk && errs.length === 0,
        errs,
      },
      null,
      2
    )
  );

  await b.close();
  process.exit(dupes.length === 0 && eyeOk && errs.length === 0 ? 0 : 1);
})();
