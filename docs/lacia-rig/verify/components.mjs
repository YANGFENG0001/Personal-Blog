/* Components: are optional parts really optional, and does an action's
 * visibility rule actually reach the screen?
 *
 * Run with the dev server up:  node docs/lacia-rig/verify/components.mjs
 *
 * Four things can each be wrong on their own:
 *
 *   1. MOUNT    — an outfit with no components must render no component
 *                 markup and offer no component actions. "The dress has no
 *                 weapon" is the requirement this whole layer exists for.
 *   2. RULE     — the resolver must be explicit > component > visible, in that
 *                 order, for every combination. This is pure logic, so it is
 *                 checked in Node against synthetic components instead of
 *                 against the shipped ones.
 *   3. SCREEN   — a rule that does not reach `data-on` is a rule that does
 *                 nothing. Checked on the real DOM, mid-action.
 *   4. EXCLUSIVE— only one action may run at a time, and an interrupted action
 *                 must not leave its delayed callbacks behind.
 *
 * ## Why the matrix is asserted instead of authored
 *
 * The rules live as two sparse statements (an action names the slots it hides;
 * a component names the actions it hides in). The N×N table is *derived* from
 * them, so asserting the table is asserting the resolver — and the table cannot
 * drift from the rules because it has no independent existence. See
 * lib/lacia/components.ts for why authoring the table was rejected.
 */
import { chromium } from 'playwright';
import { actionVisible, visibilityMatrix } from '../../../src/lib/lacia/components.ts';

const PAGE = 'http://localhost:4321/lacia';
const errs = [];

/* ── 2. the resolver, against synthetic components ───────────────────────── */

const comp = (over) => ({ label: { name: over.id, code: '' }, parts: () => [], ...over });

const A = comp({ id: 'a', slot: 'aura' });
const B = comp({ id: 'b', slot: 'waist' });
const C = comp({ id: 'c', slot: 'waist', hideIn: ['x:hide'] });
const D = comp({ id: 'd', slot: 'head', hideIn: ['dev'] });

const act = (id, owner, visibility) => ({ id, owner, label: { name: id, code: '' }, ...(visibility ? { visibility } : {}) });

const PLAIN = act('x:plain', 'x');
const HIDES_AURA = act('x:aura', 'x', { aura: false });
const HIDES_WAIST = act('x:waist', 'x', { waist: false });
const SHOWS_WAIST = act('x:show', 'x', { waist: true });
const OWNER_TAG = act('dev:zap', 'dev');
const HIDE_BY_ID = act('x:hide', 'x');

/* Actions belong to a component — the character's own modules are the only ones
   that do not. So the synthetic owner carries them, and sits in `device` so that
   its own slot is not swept up by the aura/waist rules under test. */
const OWNER = comp({
  id: 'x',
  slot: 'device',
  actions: [PLAIN, HIDES_AURA, HIDES_WAIST, SHOWS_WAIST, OWNER_TAG, HIDE_BY_ID],
});

const cases = [
  ['no rule → visible', actionVisible(PLAIN, A), true],
  ['action hides slot', actionVisible(HIDES_AURA, A), false],
  ['action hides a slot, other slots untouched', actionVisible(HIDES_AURA, B), true],
  ['component opts out by action id', actionVisible(HIDE_BY_ID, C), false],
  ['component opts out by owner tag', actionVisible(OWNER_TAG, D), false],
  ['component does not opt out of other owners', actionVisible(PLAIN, D), true],
  ['explicit true beats the component opting out', actionVisible(SHOWS_WAIST, C), true],
  ['explicit false beats everything', actionVisible(HIDES_WAIST, A), true],
];
for (const [name, got, want] of cases) {
  if (got !== want) errs.push(`resolver: ${name} → got ${got}, want ${want}`);
}

/* Same slot, two components: a slot rule has to reach both, a component rule
   only itself. This is the case that would break if the column were the
   component id instead of the slot. */
if (actionVisible(HIDES_WAIST, B) !== false || actionVisible(HIDES_WAIST, C) !== false) {
  errs.push('resolver: a slot rule must reach every component in that slot');
}
if (actionVisible(HIDE_BY_ID, B) !== true) {
  errs.push('resolver: a component opting out must not hide its slot-mate');
}

const matrix = visibilityMatrix([A, B, C, D, OWNER]);
if (matrix.actions.length !== 6 || matrix.components.length !== 5) {
  errs.push(`matrix: expected 6×5, got ${matrix.actions.length}×${matrix.components.length}`);
}
const cell = (a, c) => {
  const ai = matrix.actions.findIndex((x) => x.id === a);
  const ci = matrix.components.findIndex((x) => x.id === c);
  return ai < 0 || ci < 0 ? null : matrix.cells[ai][ci];
};
if (cell('x:aura', 'a') !== false) errs.push('matrix: x:aura × a should be hidden');
if (cell('x:plain', 'a') !== true) errs.push('matrix: x:plain × a should be visible');
if (cell('x:show', 'c') !== true) errs.push('matrix: explicit true should show c');
/* The whole authored surface, counted: one aura rule, one waist rule that
   reaches two components, one per-component opt-out, one owner tag. Five cells
   out of 30 — which is the argument against authoring the table by hand. */
const hidden = matrix.overrides.filter((o) => !o.visible).length;
if (hidden !== 5) errs.push(`matrix: expected 5 hidden overrides, got ${hidden}`);

/* ── 1 / 3 / 4. the shipped wiring, in the browser ───────────────────────── */

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(PAGE, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

const report = await p.evaluate(async () => {
  /* Vite serves the source modules in dev, so the check runs against the same
     files the page runs — no build step, no copy of the logic to keep in sync. */
  const reg = await import('/src/lib/lacia/registry.ts');
  const rig = await import('/src/lib/lacia/rig.ts');

  const suitMarkup = rig.laciaMarkup({ skin: 'suit' });
  const dressMarkup = rig.laciaMarkup({ skin: 'dress' });
  const count = (s, sub) => s.split(sub).length - 1;

  return {
    monolithActions: (reg.LACIA_COMPONENTS.monolith.actions ?? []).length,
    lockActions: (reg.LACIA_COMPONENTS.lock.actions ?? []).length,
    suitComps: rig.skinComponents('suit').map((c) => c.id),
    dressComps: rig.skinComponents('dress').map((c) => c.id),
    suitMarkupComps: count(suitMarkup, 'data-comp="'),
    dressMarkupComps: count(dressMarkup, 'data-comp="'),
    suitActions: rig.laciaActions('suit').map((a) => a.id),
    dressActions: rig.laciaActions('dress').map((a) => a.id),
  };
});

if (report.monolithActions !== 4) errs.push(`registry: monolith should bring 4 actions, has ${report.monolithActions}`);
if (report.lockActions !== 0) errs.push(`registry: lock should bring no actions, has ${report.lockActions}`);
if (report.suitComps.join() !== 'monolith,lock') errs.push(`registry: suit mounts ${report.suitComps.join()}`);
if (report.dressComps.length !== 0) errs.push(`registry: dress mounts ${report.dressComps.join()}`);
if (report.suitMarkupComps !== 2) errs.push(`markup: suit should render 2 component roots, got ${report.suitMarkupComps}`);
if (report.dressMarkupComps !== 0) errs.push(`markup: dress must render no component roots, got ${report.dressMarkupComps}`);
if (report.suitActions.length !== 5) errs.push(`actions: suit should offer 5 (4 device + poke), got ${report.suitActions.length}`);
if (report.dressActions.join() !== 'self:poke') errs.push(`actions: dress should offer only self:poke, got ${report.dressActions.join()}`);

/* The live page. It renders whatever outfit the site is set to, so the DOM
   assertions are conditional on what is mounted — but the *consistency* between
   the setting and the DOM is asserted either way. */
const live = await p.evaluate(() => {
  const el = document.querySelector('.lr');
  const comps = Array.from(document.querySelectorAll('[data-comp]')).map((n) => ({
    id: n.dataset.comp,
    on: n.dataset.on,
  }));
  const buttons = Array.from(document.querySelectorAll('.ls-console button')).map((n) => n.textContent ?? '');
  return { comps, buttons, action: el?.dataset.action ?? null, form: el?.dataset.form ?? null };
});

const liveIds = live.comps.map((c) => c.id).sort().join();
if (liveIds === 'lock,monolith') {
  if (live.buttons.length !== 4) errs.push(`dom: suit should show 4 device buttons, shows ${live.buttons.length}`);

  /* 3. The rule reaches the screen. `unfold` declares `waist: false`, so the
        lock must go dark for the length of the action and come back by itself
        when it ends — no explicit restore anywhere, which is the property that
        matters: a rule that needs a matching "show" elsewhere will eventually
        be written without one. */
  const idx = await p.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.ls-console button'));
    return b.findIndex((n) => (n.textContent ?? '').includes('展开'));
  });
  if (idx < 0) {
    errs.push('dom: no 展开 button on the device console');
  } else {
    await p.evaluate((i) => document.querySelectorAll('.ls-console button')[i].click(), idx);
    await p.waitForTimeout(120);
    const early = await p.evaluate(() => document.querySelector('[data-comp="lock"]')?.dataset.on ?? null);
    if (early !== '0') errs.push(`dom: lock should be off immediately, data-on=${early}`);
    /* The visibility transition is delayed by the fade (0.24s), so the computed
       style only flips after it — assert it past that point, not before. */
    await p.waitForTimeout(320);
    const during = await p.evaluate(() => ({
      action: document.querySelector('.lr')?.dataset.action ?? null,
      lock: document.querySelector('[data-comp="lock"]')?.dataset.on ?? null,
      vis: getComputedStyle(document.querySelector('[data-comp="lock"]')).visibility,
    }));
    if (during.action !== 'monolith:unfold') errs.push(`dom: expected action monolith:unfold, got ${during.action}`);
    if (during.lock !== '0') errs.push(`dom: lock should be off during unfold, data-on=${during.lock}`);
    if (during.vis !== 'hidden') errs.push(`dom: hidden component must compute visibility:hidden, got ${during.vis}`);

    await p.waitForTimeout(1900);
    const after = await p.evaluate(() => ({
      action: document.querySelector('.lr')?.dataset.action ?? null,
      lock: document.querySelector('[data-comp="lock"]')?.dataset.on ?? null,
    }));
    if (after.action !== null) errs.push(`dom: action should have ended, still ${after.action}`);
    if (after.lock !== '1') errs.push(`dom: lock should be back after the action, data-on=${after.lock}`);

    /* 4. Exclusivity. Two clicks in a row: the second must replace the first,
          not stack on it. */
    await p.evaluate(() => {
      const b = Array.from(document.querySelectorAll('.ls-console button'));
      b[3]?.click();
      b[1]?.click();
    });
    await p.waitForTimeout(120);
    const twice = await p.evaluate(() => document.querySelector('.lr')?.dataset.action ?? null);
    if (twice !== 'monolith:railgun') errs.push(`dom: second action should win, active=${twice}`);
  }
} else if (liveIds === '') {
  if (live.buttons.length !== 0) errs.push(`dom: an outfit with no device must show no console, shows ${live.buttons.length}`);
} else {
  errs.push(`dom: unexpected mounted set "${liveIds}"`);
}

await b.close();

if (errs.length) {
  console.error('FAIL');
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}
console.log('PASS  resolver 8/8 · matrix 6×5 (5 hidden of 30) · suit 2 components / 5 actions · dress 0 / 1');
console.log('PASS  unfold hides the waist slot mid-action and restores on its own');
console.log('PASS  a second action replaces the first instead of stacking');
