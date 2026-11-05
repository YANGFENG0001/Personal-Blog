/* 内联 SVG 造型也要走同一套组件 / 动作模型。
 *
 * Run with the dev server up:  node docs/mascot/verify/components.mjs
 *
 * 骨架那侧由 `docs/lacia-rig/verify/components.mjs` 管，这一份管三个平涂造型
 * （chibi / haru / sora）。要证的四件事：
 *
 *   1. 每个角色自带的组件真的被渲染进了标记（默认值不是摆设）；
 *   2. 显式传空数组时一件都不挂（`undefined` 与 `[]` 是两种意思）；
 *   3. 可见性规则从两半稀疏声明推导，且矩阵与 `actionVisible` 一致；
 *   4. 真 DOM 上，被抱起时伞收起、放下时回来——这是规则唯一看得见的出口。
 *
 * 源码通过 Vite 的 dev 模块图 import（`/src/...`），而不是 Node 直接 import：
 * 这些模块之间有运行时互相引用，Node 的类型剥离不做无扩展名解析。走 dev 服务
 * 顺便也证明了浏览器拿到的是同一份模块。
 *
 * 第 4 条必须走真实的指针拖拽：`held` 是拖拽产生的状态，直接写 `data-state`
 * 会绕过动作运行时，测到的就不是出货路径了。
 */
import { chromium } from 'playwright';

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (msg) => msg.type() === 'error' && errs.push(msg.text()));

await p.goto('http://localhost:4321/mascot-probe?c=sora', { waitUntil: 'networkidle' });

/* ── 1~3. 纯逻辑：默认挂载、目录、矩阵 ────────────────────────────────── */

const logic = await p.evaluate(async () => {
  const { mascotSvg } = await import('/src/lib/mascot/svg.ts');
  const { svgMounted } = await import('/src/lib/mascot/actions.ts');
  const { componentCatalog, defaultComponentIds, selfActionCount } = await import('/src/lib/mascot/catalog.ts');
  const { actionVisible, visibilityMatrix } = await import('/src/lib/mascot/model.ts');

  const looks = ['chibi', 'haru', 'sora', 'lacia'];
  const defaults = {};
  const missing = [];
  for (const look of looks) {
    const svg = mascotSvg(look);
    defaults[look] = [...svg.matchAll(/data-comp="([^"]+)"/g)].map((m) => m[1]).sort();
    for (const tag of svg.matchAll(/<g [^>]*data-comp="[^"]+"[^>]*>/g)) {
      for (const attr of ['data-slot', 'data-on="1"']) if (!tag[0].includes(attr)) missing.push(`${look}:${attr}`);
    }
  }
  const bare = mascotSvg('sora', []);

  const catalog = Object.fromEntries(looks.map((c) => [c, componentCatalog(c).map((x) => x.id).sort()]));

  const sora = svgMounted(defaultComponentIds('sora', 'suit'));
  const m = visibilityMatrix(sora.components, sora.actions);
  let mismatch = 0;
  m.cells.forEach((row, ai) =>
    row.forEach((v, ci) => {
      if (v !== actionVisible(sora.actions[ai], sora.components[ci])) mismatch++;
    }),
  );

  const bm = svgMounted(['book']);
  const book = visibilityMatrix(bm.components, bm.actions);

  return {
    defaults,
    bare: !bare.includes('data-comp') && bare.includes('ms-breath'),
    missing,
    catalog,
    self: [selfActionCount('haru'), selfActionCount('lacia')],
    defaultsSora: defaultComponentIds('sora', 'suit'),
    size: [m.cells.length, m.components.length],
    hidden: m.overrides.filter((c) => !c.visible).map((c) => `${c.action}/${c.component}`),
    bookHidden: book.overrides.filter((c) => !c.visible).map((c) => c.action).sort(),
    mismatch,
    actionCount: sora.actions.length,
  };
});

const want = { chibi: ['book'], haru: ['sakura'], lacia: [], sora: ['sunclip', 'umbrella'] };
for (const [look, ids] of Object.entries(want)) {
  ok(`默认挂载 ${look}`, JSON.stringify(logic.defaults[look]) === JSON.stringify(ids), logic.defaults[look].join(',') || '无');
}
ok('显式空数组 = 一件都不挂', logic.bare);
ok('组件根元素带齐 data-comp / data-slot / data-on', logic.missing.length === 0, logic.missing.join(' '));
ok('目录 小春 = 樱花发卡', JSON.stringify(logic.catalog.haru) === '["sakura"]', logic.catalog.haru.join(','));
ok('目录 小晴 = 雨伞 + 太阳发夹', JSON.stringify(logic.catalog.sora) === '["sunclip","umbrella"]', logic.catalog.sora.join(','));
ok('目录不会给错角色', !logic.catalog.haru.includes('umbrella') && !logic.catalog.sora.includes('sakura'));
ok('目录 蕾西亚 = 骨架那两件', logic.catalog.lacia.length === 2, logic.catalog.lacia.join(','));
ok('自带动作数：造型 6 / 骨架 1', logic.self[0] === 6 && logic.self[1] === 1, logic.self.join(' / '));
ok('默认挂载随角色', logic.defaultsSora.join(',') === 'umbrella,sunclip');
ok('矩阵尺寸 = 动作 × 组件', logic.size[1] === 2 && logic.size[0] === logic.actionCount, `${logic.size[0]}×${logic.size[1]}`);
ok('出厂规则 1 条（伞 · 抱起）', logic.hidden.length === 1 && logic.hidden[0] === 'svg:held/umbrella', logic.hidden.join(' '));
ok('书 让开 被抱起 + 睡着', JSON.stringify(logic.bookHidden) === '["svg:held","svg:sleep"]', logic.bookHidden.join(','));
ok('矩阵与 actionVisible 逐格一致', logic.mismatch === 0, `${logic.mismatch} 格不一致`);

/* ── 4. 真 DOM：拖起来伞会收 ───────────────────────────────────────────── */

await p.waitForSelector('[data-mascot] [data-comp="umbrella"]', { timeout: 10000 });
const umbrellaOn = () => p.evaluate(() => document.querySelector('[data-comp="umbrella"]').dataset.on);
const talking = () => p.evaluate(() => document.querySelector('[data-mascot]').classList.contains('is-talking'));

ok('小晴渲染出两件组件', (await p.evaluate(() => document.querySelectorAll('[data-mascot] [data-comp]').length)) === 2);
ok('待机时伞是显示的', (await umbrellaOn()) === '1');

/* 拖 40px 就会进 `held`（阈值是 5px），动作运行时随即使伞让开。 */
const box = await p.locator('[data-mascot] .mascot-btn').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + 40, box.y + box.height * 0.6 + 20, { steps: 6 });
await p.waitForTimeout(120);
ok('被抱起时伞让开', (await umbrellaOn()) === '0');

/* 淡出是 0.24s 的过渡，`visibility` 被延迟到它之后——先等过去再读计算样式。 */
await p.waitForTimeout(340);
const vis = await p.evaluate(() => getComputedStyle(document.querySelector('[data-comp="umbrella"]')).visibility);
ok('让开之后真的不绘制', vis === 'hidden', vis);

await p.mouse.up();
await p.waitForTimeout(420);
ok('放下后伞自己回来', (await umbrellaOn()) === '1');

/* 组件自带的交互模组：点伞面转一圈，且不抢"说话"。 */
await p.evaluate(() => document.querySelector('[data-mascot]').classList.remove('is-talking'));
const ub = await p.locator('[data-comp="umbrella"] .ms-umb-canopy').boundingBox();
await p.mouse.click(ub.x + ub.width / 2, ub.y + ub.height / 2);
await p.waitForTimeout(80);
ok('点伞面触发 umbrella:twirl', await p.evaluate(() => document.querySelector('[data-mascot]').classList.contains('is-twirl')));
ok('转伞不会顺带说话', !(await talking()));
await p.waitForTimeout(1300);
ok('转完自己收场', !(await p.evaluate(() => document.querySelector('[data-mascot]').classList.contains('is-twirl'))));

/* Q 版的书。 */
await p.goto('http://localhost:4321/mascot-probe?c=chibi', { waitUntil: 'networkidle' });
await p.waitForSelector('[data-mascot] [data-comp="book"]', { timeout: 10000 });
ok('Q 版渲染出书', (await p.evaluate(() => document.querySelector('[data-comp="book"]').dataset.on)) === '1');

ok('没有页面报错', errs.length === 0, errs.slice(0, 3).join(' | '));

await b.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
