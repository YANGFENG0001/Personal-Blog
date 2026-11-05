/* Every SVG look must have five distinguishable faces.
 *
 * Run with the dev server up:  node docs/mascot/verify/faces.mjs [--shots]
 *
 * The check is the same one `docs/lacia-rig/verify/states.cjs` makes for the
 * rigged character, applied to the three inline-SVG looks (chibi / haru / sora):
 * set `data-state`, then read **which shape is actually visible**. That is the
 * only thing that survives being 70 units tall — two states that differ only in
 * an offset look identical in a screenshot and are, in fact, the same face.
 *
 * The SVGs are pulled from `src/lib/mascot/svg.ts` through the dev server's module
 * graph and injected into a real page, so the markup under test is the shipped
 * markup and the CSS under test is the shipped CSS. (Node's TypeScript stripping
 * cannot resolve the extensionless imports between those modules, so the import
 * happens in the browser instead.)
 */
import { chromium } from 'playwright';

const LOOKS = ['chibi', 'haru', 'sora'];
const STATES = ['idle', 'talk', 'happy', 'held', 'sleep'];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await p.waitForSelector('[data-mascot]', { timeout: 10000 });

const shots = process.argv.includes('--shots');
const rows = [];

for (const look of LOOKS) {
  await p.evaluate(async (id) => {
    const { mascotSvg } = await import('/src/lib/mascot/svg.ts');
    document.querySelector('[data-mascot-body]').innerHTML = mascotSvg(id);
  }, look);
  await p.waitForTimeout(120);

  for (const state of STATES) {
    const face = await p.evaluate(async (s) => {
      const root = document.querySelector('[data-mascot]');
      root.dataset.state = s;
      await new Promise((r) => setTimeout(r, 280)); // 0.18s cross-fade + slack
      const on = (el) => +getComputedStyle(el).opacity > 0.5;
      const pick = (sel, prefix) => {
        const el = [...root.querySelectorAll(sel)].find(on);
        if (!el) return null;
        return el.getAttribute('class').split(/\s+/).find((c) => c.startsWith(prefix)) ?? '?';
      };
      return {
        mouth: pick('.ms-mouth', 'ms-mouth-'),
        brow: pick('.ms-brow', 'ms-brow-'),
        cheeks: !!root.querySelector('.ms-cheeks') && on(root.querySelector('.ms-cheeks')),
        shut: !!root.querySelector('.ms-eyes-shut') && on(root.querySelector('.ms-eyes-shut')),
        happy: !!root.querySelector('.ms-happy') && on(root.querySelector('.ms-happy')),
        eyes: !!root.querySelector('.ms-eyes') && on(root.querySelector('.ms-eyes')),
      };
    }, state);
    rows.push({ look, state, ...face });
    if (shots) {
      const clip = await p.evaluate(() => {
        const r = document.querySelector('[data-mascot-body]').getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      });
      await p.screenshot({ path: `.ref/look-${look}-${state}.png`, clip });
    }
  }
}

for (const look of LOOKS) {
  const mine = rows.filter((r) => r.look === look);
  console.log(`\n${look}`);
  for (const r of mine) {
    console.log(
      `  ${r.state.padEnd(6)} mouth=${String(r.mouth).padEnd(12)} brow=${String(r.brow).padEnd(10)}` +
        ` cheeks=${r.cheeks ? 'on ' : 'off'} shut=${r.shut ? 'y' : 'n'} happy=${r.happy ? 'y' : 'n'} eyes=${r.eyes ? 'y' : 'n'}`
    );
  }
}

/* A state is "the same face" as another if every visible shape matches. */
const dupes = [];
for (const look of LOOKS) {
  const seen = new Map();
  for (const r of rows.filter((x) => x.look === look)) {
    const k = [r.mouth, r.brow, r.cheeks, r.shut, r.happy].join('|');
    if (seen.has(k)) dupes.push(`${look}: ${seen.get(k)} == ${r.state}`);
    else seen.set(k, r.state);
  }
}

/* Sleeping must actually shut the eyes; every other state must show eyes — the
   open ones, or the happy arcs that replace them. "Replaced" counts, because a
   delighted face with open eyes is not delighted; a blank face is the failure. */
const eyesOk = rows.every((r) => (r.state === 'sleep' ? r.shut && !r.eyes : r.eyes || r.happy));

console.log(
  '\n' +
    JSON.stringify(
      { looks: LOOKS.length, statesEach: STATES.length, duplicates: dupes, eyesOk, pass: !dupes.length && eyesOk && !errs.length, errs },
      null,
      2
    )
);

await b.close();
process.exit(!dupes.length && eyesOk && !errs.length ? 0 : 1);
