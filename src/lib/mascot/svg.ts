/**
 * 站内原创看板娘（内联 SVG 造型），不需要任何图片请求。角色均为原创设计。
 *
 * - chibi: 最早的 Q 版夏日制服少女（「夏日物语」主题）。
 * - haru:  栗色长发、樱花发卡、水手服。
 * - sora:  深色短发侧辫、太阳发夹、透明雨伞。
 * - lacia: 淡紫长发、冰蓝眼睛，致敬《BEATLESS》（非官方立绘）。角落里她用的是
 *          骨架版（`lib/lacia`），这里的平涂版本只作后台预览与兜底。
 *
 * 三个人像共用一套构造，站点才不会看着像拼的：
 *
 *   head   高 98 × 宽 77（≈1.27），颅顶 y=20，下巴 y=118
 *   eyes   线在 y≈79，每只 22 × 25，眼距一只眼宽，虹膜填满眼窝，
 *          粗上睫毛带外挑、双眼皮褶、细下睫毛
 *   nose   y≈93 一条 2px 阴影弧（动画的鼻子不描边）
 *   mouth  小，宽 8，在 y≈105，距下巴 13
 *   neck   宽 20，下巴下可见约 26，带下颌投影
 *   body   肩宽 104（≈1.35 头）在 y=167，向下展到 134 于裁切线 y=250
 *   hair   一片刘海，下缘是一串软尖（绝不是一排独立的发绺——那读起来像獠牙
 *          或砖块），下面垫一层深色弧填住缺口，露出的才是头发不是皮肤；侧发
 *          从窄到宽收到一个尖；后发加光泽与发丝。**不要大面积的半透明高光**：
 *          它会把发丝缝抹平，整片刘海变成一块锯齿边的面纱。
 *
 * ## 组件
 *
 * 可以拆下来的东西（发卡、伞、书）不画在这里，而是从 `lib/mascot/parts.ts` 的
 * 组件表按挂载点注入。判据是"拿掉之后人物仍然完整"：发卡、伞、书满足；头发、
 * 校服、侧辫不满足，所以留在造型里。
 *
 * 类名（ms-*）驱动 CSS 动画：呼吸、发丝摆动、眨眼、视线跟随、说话时的笑脸。
 * 几何通过下面的常量共享，角色之间只有配色与服装不同。
 */
import type { MascotComponent, MascotMount } from './model';
import { resolveComponents } from './model';
import { SVG_COMPONENTS, SVG_COMPONENT_DEFAULTS } from './parts';
import { isMascotId, type MascotId } from './meta';

/* ------------------------------------------------------- shared geometry */

const SKIN = { base: '#ffeade', low: '#fbd7c7', shade: '#f0b6a4', line: '#dc9a88' };

/** Face silhouette: wide cranium, straight jaw line, soft rounded chin. */
const FACE =
  'M100 20C82 20 66 34 63 55C61 66 61 75 64 84C67 93 72 99 78 104C83 109 91 114 96 116.5C98 117.6 102 117.6 104 116.5C109 114 117 109 122 104C128 99 133 93 136 84C139 75 139 66 137 55C134 34 118 20 100 20Z';

/** Neck, drawn under the head; the head covers everything above the chin. */
const NECK = 'M90 106V152C90 158 94 162 100 162C106 162 110 158 110 152V106Z';

/** Shadow the jaw casts on the neck. */
const NECK_SHADE = 'M89.5 118C89.5 130 94 137 100 138.5C106 137 110.5 130 110.5 118Z';

/** Shoulders / chest, cut by the bottom mask fade. */
const BODY =
  'M100 147C80 147 60 155 48 167C40 175 35 185 33 250H167C165 185 160 175 152 167C140 155 120 147 100 147Z';

type Tip = [x: number, depth: number];

interface Look {
  id: MascotId;
  hair: [string, string, string];
  hairHi: string;
  iris: [string, string, string];
  pupil: string;
  lash: string;
  /** half-widths of the back-hair fall at crown / shoulder / bottom. */
  backW: [number, number, number];
  /** fringe tips, left to right: [x, depth]. */
  bangs: Tip[];
  outfit: string;
  outfitBase: string;
  /** 画在呼吸组之前的整块东西（蕾西亚的装置碎片）。可拆卸的挂件走组件表。 */
  behind?: string;
  front?: string;
}

/* -------------------------------------------------------------------- eye */

/**
 * One eye, drawn on the left half; the right eye is the same group mirrored.
 * Socket 22 × 25 with the iris filling it, a thick upper lash with an outward
 * flick, a double-lid crease on the skin and a thin lower lash.
 */
function eye(L: Look, side: 'l' | 'r'): string {
  const clip = `${L.id}-eye-${side}`;
  const socket =
    'M91.5 81C88.5 69.5 79.5 65.5 72.2 71.5C69.2 74.2 68.6 77.8 69.6 80.8C72.6 88 81 92 88.2 89C90.8 87.8 91.7 84.4 91.5 81Z';
  return `<clipPath id="${clip}"><path d="${socket}"/></clipPath>
      <path d="${socket}" fill="#fdfbff"/>
      <g clip-path="url(#${clip})">
        <g class="ms-iris ms-iris-${side}">
          <ellipse cx="80" cy="79.4" rx="8.4" ry="10.8" fill="url(#${L.id}-iris)"/>
          <ellipse cx="80" cy="79.8" rx="3.5" ry="5.2" fill="${L.pupil}"/>
          <path d="M71.8 88.6Q80 93.4 88.2 88.4" fill="none" stroke="${L.iris[2]}" stroke-width="2.2" opacity=".9"/>
          <ellipse cx="75.6" cy="73.8" rx="2.9" ry="3.7" fill="#fff" transform="rotate(-16 75.6 73.8)"/>
          <circle cx="84.4" cy="86" r="1.5" fill="#fff" opacity=".92"/>
        </g>
        <path d="M67.5 69.5Q80 63 93 70.5V78Q80 69.5 67.5 76Z" fill="${L.iris[0]}" opacity=".4"/>
      </g>
      <path d="M91.6 80.4C88.4 68.6 79.2 64 71.6 70.8C68.6 73.4 68.2 77 69.4 80.2" fill="none" stroke="${L.lash}" stroke-width="2.9" stroke-linecap="round"/>
      <path d="M70.8 79.6C69 76 69.5 72.6 72 70.4L66.6 69.6C68.1 72.4 69 75.6 69.4 79.2Z" fill="${L.lash}"/>
      <path d="M70.4 81.8C73.5 88.2 81 91.6 87.4 89" fill="none" stroke="${L.lash}" stroke-width="1.15" opacity=".55" stroke-linecap="round"/>`;
}

/** Double-lid crease. On the skin, so it must not blink with the eye. */
function eyeSkin(L: Look, side: 'l' | 'r'): string {
  const crease =
    '<path d="M88 65.2C82.6 60.4 74.4 60.8 70 66.4" fill="none" stroke="' + L.lash + '" stroke-width="1.05" opacity=".45" stroke-linecap="round"/>';
  return side === 'l' ? crease : `<g transform="translate(200 0) scale(-1 1)">${crease}</g>`;
}

/* ------------------------------------------------------------------ brows */

/**
 * Four brows, one shape each — the same four the rigged character uses, and for
 * the same reason: a brow that is only *offset* cannot say "focused" or
 * "asleep", it can only say "a bit higher". `raise` and `drop` move the whole
 * strip, `furrow` rotates it about the outer end.
 *
 * Drawn on the left half and mirrored, like every other paired feature here.
 * `[outer, inner]` are the y of the two ends; the control points bulge up by
 * ~3.4 so the strip keeps the source's slight arch.
 */
const BROW_SHAPES: Record<string, [number, number]> = {
  neutral: [57.4, 57],
  raise: [55.0, 54.4],
  furrow: [56.6, 60.4],
  drop: [60.6, 58.6],
};

function brows(L: Look): string {
  const mirror = 'translate(200 0) scale(-1 1)';
  return Object.entries(BROW_SHAPES)
    .map(([v, [o, i]]) => {
      const mid = (o + i) / 2;
      const d = `M74 ${o}C78.6 ${mid - 3.4} 85.6 ${mid - 3.2} 90 ${i}`;
      const path = `<path d="${d}" fill="none" stroke="${L.hair[2]}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
      return `<g class="ms-brow ms-brow-${v}">${path}<g transform="${mirror}">${path}</g></g>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ mouth */

/**
 * Five mouths, drawn rather than derived. An SVG mouth is a path, so unlike the
 * rigged character there is no bitmap to squash — the shape can simply *be*
 * different, which is what "露齿" and "睡着" actually need.
 *
 * The five correspond one-to-one with the five states, plus `grin` for `happy`.
 * `talk` is the only one that gets scaled at runtime (see `--ms-open`).
 */
function mouths(): string {
  return `<path class="ms-mouth ms-mouth-idle" d="M96.6 104.4Q100 107.6 103.4 104.4" fill="none" stroke="#c4687a" stroke-width="1.6" stroke-linecap="round"/>
        <path class="ms-mouth ms-mouth-talk" d="M96 103.2Q100 111.6 104 103.2Q100 106 96 103.2Z" fill="#c25a6a"/>
        <g class="ms-mouth ms-mouth-grin">
          <path d="M94.6 102.8Q100 113 105.4 102.8Q100 105.6 94.6 102.8Z" fill="#c25a6a"/>
          <path d="M96.2 103.4Q100 104.8 103.8 103.4L103.4 105.2Q100 106.4 96.6 105.2Z" fill="#f8eef1"/>
        </g>
        <ellipse class="ms-mouth ms-mouth-pout" cx="100" cy="105" rx="1.9" ry="2.4" fill="#c25a6a"/>
        <path class="ms-mouth ms-mouth-sleep" d="M96.8 105.4Q100 108.4 103.2 105.4" fill="none" stroke="#c4687a" stroke-width="1.5" stroke-linecap="round"/>`;
}

/**
 * Shut eyes for `sleep`. Drawn, not squashed: a closed eye is a curve, and
 * `scaleY(.07)` on the open eye leaves the lash and the iris smeared into a
 * band. The happy arcs are the opposite curvature (∩) so the two never read as
 * the same face.
 */
function eyesShut(L: Look): string {
  const d = 'M71.6 79.4Q80 85.2 88.4 79.4';
  const one = `<path d="${d}" fill="none" stroke="${L.lash}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M70.4 78.2l-2.6-1.4" fill="none" stroke="${L.lash}" stroke-width="1.8" stroke-linecap="round"/>`;
  return `<g class="ms-eyes-shut">${one}<g transform="translate(200 0) scale(-1 1)">${one}</g></g>`;
}

/* ------------------------------------------------------------------- hair */

function backHair(L: Look): string {
  const [a, b, c] = L.backW;
  const l1 = 100 - a, l2 = 100 - b, l3 = 100 - c;
  const r1 = 100 + a, r2 = 100 + b, r3 = 100 + c;
  const d =
    `M100 14C${100 - a * 0.74} 14 ${l1} 32 ${l1} 56` +
    `C${l1} 84 ${l2} 116 ${l2} 154C${l2} 188 ${l3} 220 ${l3} 250` +
    `H${r3}C${r3} 220 ${r2} 188 ${r2} 154C${r2} 116 ${r1} 84 ${r1} 56` +
    `C${r1} 32 ${100 + a * 0.74} 14 100 14Z`;
  const gloss =
    `<path d="M60 62C52 104 47 152 43 208C49 208 53 158 57 116C61 84 63 72 66 62Z" fill="url(#${L.id}-gloss)"/>` +
    `<path d="M140 62C148 104 153 152 157 208C151 208 147 158 143 116C139 84 137 72 134 62Z" fill="url(#${L.id}-gloss)"/>`;
  // A few long strand lines keep the fall from reading as one flat slab.
  const strands =
    `<path d="M74 70C68 110 64 158 60 214M88 66C84 108 82 156 80 214M126 66C130 108 132 156 134 214M140 70C146 110 150 158 154 214" fill="none" stroke="${L.hair[2]}" stroke-width=".9" opacity=".28"/>`;
  return `<path d="${d}" fill="url(#${L.id}-hair)" stroke="${L.hair[2]}" stroke-width="1"/>${gloss}${strands}`;
}

/**
 * Fringe silhouette: one dome over the skull whose lower edge is a chain of
 * soft points. `tips` lists [x, depth] left to right; the edge leaves the left
 * temple and returns to the right one, with a quadratic notch between tips.
 * Drawing the fringe as one mass (instead of separate lock shapes) is what
 * keeps it from reading as a row of fangs or a stack of bricks.
 */
function fringePath(tips: [number, number][], templeY = 56, notch = 8): string {
  const pts: [number, number][] = [[50, templeY], ...tips, [150, templeY]];
  let edge = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    edge += `Q${Math.round(x0 + (x1 - x0) * 0.36)} ${Math.round(Math.min(y0, y1) - notch)} ${x1} ${y1}`;
  }
  return `M100 12C71 12 51 28 50 ${templeY}${edge}C149 28 129 12 100 12Z`;
}

function frontHair(L: Look): string {
  const s = L.hair[2];
  const g = `url(#${L.id}-hair)`;
  const fringe = fringePath(L.bangs);
  // Under-layer: a smooth arc that sits *between* the notch line and the tip
  // line, in the darkest hair tone. The notches reveal this instead of skin, so
  // the tips read as strands; because it never drops below the tips it cannot
  // show up as a second, darker fringe.
  const under = 'M50 40C66 62 134 62 150 40L150 30C150 22 128 15 100 15C72 15 50 22 50 30Z';
  // Strand seams: from each notch up into the hair mass, tapering off.
  const seams = L.bangs
    .slice(0, -1)
    .map(([x], i) => {
      const nx = Math.round((x + L.bangs[i + 1]![0]) / 2);
      const top = 28 + (i % 2) * 7;
      return `<path d="M${nx} ${top}C${nx - 2} ${top + 12} ${nx - 1} 48 ${nx} 56" fill="none" stroke="${s}" stroke-width=".8" opacity=".3"/>`;
    })
    .join('');
  const hi =
    `<path d="M70 34C78 26 88 23 97 23" fill="none" stroke="${L.hairHi}" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>` +
    `<path d="M104 23C114 24 124 28 131 34" fill="none" stroke="${L.hairHi}" stroke-width="2" opacity=".45" stroke-linecap="round"/>` +
    `<path d="M63 44C70 34 80 30 88 29" fill="none" stroke="${L.hairHi}" stroke-width="1.3" opacity=".3" stroke-linecap="round"/>`;
  const side = (flip: boolean) => {
    const p = 'M63 46C56 74 55 104 58 132C60 154 56 172 52 192C60 182 66 162 68 138C70 110 70 78 67 50Z';
    const el =
      `<path class="ms-lock${flip ? ' ms-lock-r' : ''}" d="${p}" fill="${g}" stroke="${s}" stroke-width=".7" stroke-opacity=".35"/>` +
      `<path d="M62 62C59 88 59 114 60 138" fill="none" stroke="${L.hairHi}" stroke-width="1.2" opacity=".22" stroke-linecap="round"/>`;
    return flip ? `<g transform="translate(200 0) scale(-1 1)">${el}</g>` : el;
  };
  return side(false) + side(true) + `<path d="${under}" fill="${s}" opacity=".9"/>` + `<path d="${fringe}" fill="${g}" stroke="${s}" stroke-width="1" stroke-linejoin="round"/>` + seams + hi;
}

/* ------------------------------------------------------------------- bust */

/**
 * 组件按挂载点注入。`at()` 是唯一知道"哪块标记插在哪"的地方——造型本身不知
 * 道有什么组件，组件也不知道自己被插在哪里，两边只认挂载点这个名字。
 */
function mountMap(comps: readonly MascotComponent<unknown, unknown>[]): (m: MascotMount) => string {
  const byMount = new Map<MascotMount, string>();
  for (const c of comps) {
    for (const part of c.parts({ uid: c.id, subject: undefined })) {
      byMount.set(part.mount, (byMount.get(part.mount) ?? '') + part.html);
    }
  }
  return (m) => byMount.get(m) ?? '';
}

function bust(L: Look, comps: readonly MascotComponent<unknown, unknown>[]): string {
  const id = L.id;
  const at = mountMap(comps);
  const mirror = 'translate(200 0) scale(-1 1)';
  const happy = `<path d="M71.5 83Q80 71 88.5 83" fill="none" stroke="${L.lash}" stroke-width="2.8" stroke-linecap="round"/>`;
  return `<svg class="mascot-svg ms-anime" viewBox="0 0 200 250" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-hair" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="150"><stop offset="0" stop-color="${L.hair[0]}"/><stop offset=".45" stop-color="${L.hair[1]}"/><stop offset="1" stop-color="${L.hair[2]}"/></linearGradient>
    <linearGradient id="${id}-gloss" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="212"><stop offset="0" stop-color="${L.hairHi}" stop-opacity=".55"/><stop offset=".6" stop-color="${L.hairHi}" stop-opacity=".2"/><stop offset="1" stop-color="${L.hairHi}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.iris[0]}"/><stop offset=".58" stop-color="${L.iris[1]}"/><stop offset="1" stop-color="${L.iris[2]}"/></linearGradient>
    <linearGradient id="${id}-skin" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="170"><stop offset="0" stop-color="${SKIN.base}"/><stop offset="1" stop-color="${SKIN.low}"/></linearGradient>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="${id}-mask" maskUnits="userSpaceOnUse" x="-40" y="-60" width="280" height="310"><rect x="-40" y="-60" width="280" height="310" fill="url(#${id}-fade)"/></mask>
  </defs>
  <g mask="url(#${id}-mask)">
    ${at('behind')}${L.behind ?? ''}
    <g class="ms-breath">
      ${backHair(L)}
      <path d="${NECK}" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
      <path d="${NECK_SHADE}" fill="${SKIN.shade}" opacity=".5"/>
      ${L.outfit}
      ${L.front ?? ''}
      <g class="ms-head">
        <path d="${FACE}" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
        <path d="M136 84C133 93 128 99 122 104C127 97 131 91 133 81Z" fill="${SKIN.shade}" opacity=".3"/>
        <path d="M66 60C76 55 88 53 100 53L100 62C89 62 77 64 68 69Z" fill="${SKIN.shade}" opacity=".12"/>
        <g class="ms-eyes">
          <g>${eye(L, 'l')}</g>
          <g transform="${mirror}">${eye(L, 'r')}</g>
        </g>
        ${eyesShut(L)}
        <g class="ms-happy" stroke-linecap="round">${happy}<g transform="${mirror}">${happy}</g></g>
        ${eyeSkin(L, 'l')}${eyeSkin(L, 'r')}
        ${brows(L)}
        <path d="M99.4 89.6C101.4 92.4 101.6 94.2 99.8 95" fill="none" stroke="${SKIN.line}" stroke-width="1.15" stroke-linecap="round" opacity=".7"/>
        ${mouths()}
        <g class="ms-cheeks">
          <ellipse cx="80" cy="97.4" rx="7.4" ry="3.2" fill="#ff9fb3" opacity=".3"/><ellipse cx="120" cy="97.4" rx="7.4" ry="3.2" fill="#ff9fb3" opacity=".3"/>
          <path d="M75.6 99.2l2.2-3.2 M79.4 99.2l2.2-3.2 M83.2 99.2l2.2-3.2 M115.6 99.2l2.2-3.2 M119.4 99.2l2.2-3.2 M123.2 99.2l2.2-3.2" stroke="#ee7890" stroke-width=".85" opacity=".4" stroke-linecap="round"/>
        </g>
        ${frontHair(L)}
        ${at('head')}
      </g>
    </g>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ chibi */

/**
 * Q 版。160×200 的画布，全身而不是半身，所以它没有 `ms-breath`/`ms-head` 那
 * 套半身结构——呼吸与摆头挂在 `ms-body` / `ms-head` 上，幅度也更小。
 */
function chibi(comps: readonly MascotComponent<unknown, unknown>[]): string {
  const at = mountMap(comps);
  return `<svg class="mascot-svg ms-chibi" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="chibi-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9dc"/><stop offset="1" stop-color="#f3c9b8"/></linearGradient>
    <linearGradient id="chibi-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6f6"/></linearGradient>
    <linearGradient id="chibi-skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d4c96"/><stop offset="1" stop-color="#2a3468"/></linearGradient>
  </defs>
  ${at('behind')}
  <ellipse class="ms-shadow" cx="80" cy="192" rx="42" ry="6"/>
  <g class="ms-body">
    <path class="ms-hair" d="M30 70 q-22 26 -10 64 q6 -20 18 -30 z"/>
    <path class="ms-hair" d="M130 70 q22 26 10 64 q-6 -20 -18 -30 z"/>
    <circle class="ms-ribbon" cx="34" cy="66" r="7"/><circle class="ms-ribbon" cx="126" cy="66" r="7"/>
    <rect class="ms-skin" x="62" y="160" width="10" height="24" rx="4"/><rect class="ms-skin" x="88" y="160" width="10" height="24" rx="4"/>
    <path class="ms-shoe" d="M58 182 h18 v6 h-20z M86 182 h18 v6 h-20z"/>
    <path class="ms-skirt" d="M52 146 h56 l10 22 h-76z"/>
    <path class="ms-pleat" d="M66 148 l-4 20 M80 148 v20 M94 148 l4 20"/>
    <path class="ms-shirt" d="M54 116 q26 -10 52 0 l4 32 h-60z"/>
    <path class="ms-collar" d="M58 116 q22 18 44 0 l-6 14 q-16 8 -32 0z"/>
    <path class="ms-scarf" d="M76 128 l4 8 l4 -8 l-4 -3z"/>
    <path class="ms-skin" d="M52 122 q-10 16 0 28 l8 -4 q-6 -10 0 -20z"/>
    <path class="ms-skin" d="M108 122 q10 16 0 28 l-8 -4 q6 -10 0 -20z"/>
    <ellipse class="ms-cuff" cx="52" cy="148" rx="5" ry="4"/>
    <ellipse class="ms-cuff" cx="108" cy="148" rx="5" ry="4"/>
    ${at('body')}
    <g class="ms-head">
      <circle class="ms-skin" cx="80" cy="74" r="40"/>
      <ellipse class="ms-face-shade" cx="80" cy="99" rx="32" ry="23"/>
      <ellipse class="ms-earring" cx="42" cy="97" rx="2.4" ry="2.4"/>
      <ellipse class="ms-earring" cx="118" cy="97" rx="2.4" ry="2.4"/>
      <path class="ms-hair" d="M40 76 q-2 -46 40 -48 q42 2 40 48 q-8 -22 -22 -26 q-6 12 -20 14 q4 -8 2 -14 q-14 14 -40 26z"/>
      <path class="ms-hair-hi" d="M58 40 q10 -6 22 -6"/>
      <g class="ms-eyes">
        <ellipse class="ms-eye" cx="64" cy="82" rx="6.5" ry="8"/><ellipse class="ms-eye" cx="96" cy="82" rx="6.5" ry="8"/>
        <circle class="ms-shine" cx="66" cy="79" r="2.3"/><circle class="ms-shine" cx="98" cy="79" r="2.3"/>
      </g>
      <g class="ms-eyes-shut"><path d="M57.5 82.6q6.5 4.2 13 0"/><path d="M89.5 82.6q6.5 4.2 13 0"/></g>
      <g class="ms-happy"><path d="M57.5 82.4q6.5-4.6 13 0"/><path d="M89.5 82.4q6.5-4.6 13 0"/></g>
      <g class="ms-cheeks">
        <ellipse class="ms-blush" cx="56" cy="96" rx="6" ry="3"/><ellipse class="ms-blush" cx="104" cy="96" rx="6" ry="3"/>
      </g>
      <path class="ms-mouth ms-mouth-idle" style="fill:none;stroke:#b5546f;stroke-width:2" d="M75 98q5 5 10 0"/>
      <path class="ms-mouth ms-mouth-talk" style="fill:#c25a6a;stroke:none" d="M76.6 97.4q3.4 6.4 6.8 0q-3.4 2.6-6.8 0z"/>
      <g class="ms-mouth ms-mouth-grin">
        <path style="fill:#c25a6a;stroke:none" d="M75.4 97.2q4.6 7.6 9.2 0q-4.6 3 -9.2 0z"/>
        <path style="fill:#f8eef1;stroke:none" d="M76.6 97.8q3.4 1.2 6.8 0l-.3 1.4q-3.1 1 -6.2 0z"/>
      </g>
      <ellipse class="ms-mouth ms-mouth-pout" style="fill:#c25a6a;stroke:none" cx="80" cy="98.6" rx="1.7" ry="2.1"/>
      <path class="ms-mouth ms-mouth-sleep" style="fill:none;stroke:#b5546f;stroke-width:1.8" d="M76.2 98.8q3.8 2.4 7.6 0"/>
      <path class="ms-clip" d="M106 50 l8 -4 l2 6z"/>
      ${at('head')}
    </g>
  </g>
</svg>`;
}

/* -------------------------------------------------------------- characters */

const HARU: Look = {
  id: 'haru',
  hair: ['#7c4d3e', '#563429', '#33201a'],
  hairHi: '#eec1a6',
  iris: ['#4b2443', '#a5527c', '#f7b3cc'],
  pupil: '#2a1024',
  lash: '#2d1a1f',
  backW: [40, 47, 54],
  bangs: [[64, 62], [88, 57], [112, 57], [138, 63]],
  outfitBase: '#f6f7fc',
  outfit: `<path d="${BODY}" fill="#f6f7fc" stroke="#ccd2e2" stroke-width="1"/>
      <path d="M52 186C50 208 49 228 48 250M148 186C150 208 151 228 152 250" fill="none" stroke="#d7dcea" stroke-width="1.2"/>
      <path d="M86 148L100 214L114 148L127 155L100 227L73 155Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M50 170C62 159 76 152 87 149L90 160C79 163 66 170 56 179Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M150 170C138 159 124 152 113 149L110 160C121 163 134 170 144 179Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M79 155L100 220L121 155" fill="none" stroke="#fff" stroke-width="1.4" opacity=".9"/>
      <path d="M75 157L100 224L125 157" fill="none" stroke="#fff" stroke-width=".9" opacity=".6"/>
      <path d="M100 216L86 208L83 222Z" fill="#e2577f" stroke="#b83a62" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M100 216L114 208L117 222Z" fill="#e2577f" stroke="#b83a62" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M100 218L94 246L99 246Z" fill="#d84a73"/>
      <path d="M100 218L106 246L101 246Z" fill="#d84a73"/>
      <ellipse cx="100" cy="216" rx="4.4" ry="3.8" fill="#c93f68"/>`,
};

const SORA: Look = {
  id: 'sora',
  hair: ['#3d4869', '#252c45', '#151929'],
  hairHi: '#a6caf5',
  iris: ['#173563', '#3f8fd8', '#b0e9ff'],
  pupil: '#0d1830',
  lash: '#161a2a',
  backW: [39, 45, 51],
  bangs: [[66, 58], [90, 53], [112, 53], [138, 59]],
  outfitBase: '#7cc0ec',
  outfit: `<path d="${BODY}" fill="#7cc0ec" stroke="#4f97c9" stroke-width="1"/>
      <path d="M100 138C80 138 64 150 58 168C72 160 86 156 100 156C114 156 128 160 142 168C136 150 120 138 100 138Z" fill="#5fa9dc" stroke="#3f88bc" stroke-width="1"/>
      <path d="M86 148C92 143 108 143 114 148L112 162C104 158 96 158 88 162Z" fill="#5fa9dc" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M100 162V250" stroke="#3f88bc" stroke-width="1.6"/>
      <path d="M92 162V250M108 162V250" stroke="#5aa3d6" stroke-width="1.1" opacity=".75"/>
      <circle cx="100" cy="194" r="2.2" fill="#f4f8fc" stroke="#3f88bc" stroke-width=".7"/>
      <circle cx="100" cy="220" r="2.2" fill="#f4f8fc" stroke="#3f88bc" stroke-width=".7"/>
      <path d="M58 220L82 214L82 221L58 227Z" fill="#6fb6e6" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M142 220L118 214L118 221L142 227Z" fill="#6fb6e6" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M54 188C52 208 51 228 50 250M146 188C148 208 149 228 150 250" fill="none" stroke="#5aa3d6" stroke-width="1.2"/>`,
  front: `<g class="ms-braid" fill="url(#sora-hair)" stroke="#151929" stroke-width=".9">
      <ellipse cx="138" cy="144" rx="6" ry="7.8"/><ellipse cx="139" cy="157" rx="5.8" ry="7.6"/><ellipse cx="140" cy="169" rx="5.4" ry="7.2"/><ellipse cx="141" cy="181" rx="4.8" ry="6.4"/>
      <path d="M139 189q-3 8 0 12q3-4 4-12z"/>
      <rect x="136.5" y="186" width="9" height="3.4" rx="1.6" fill="#ffcf5a" stroke="#d9a42e"/>
    </g>`,
};

/**
 * 蕾西亚的平涂版 — 视觉语言取自 BEATLESS 的 hIE：淡紫银发、冰蓝眼睛、白黑紧身
 * 衣带一道冰蓝缝线，肩后浮着一片黑色装置。这是致敬，**不是**官方立绘的复刻。
 * 角落里她用的是骨架版，这里只作后台预览的兜底。
 */
const LACIA: Look = {
  id: 'lacia',
  hair: ['#e2d9f6', '#b0a0dd', '#7d68bb'],
  hairHi: '#fbf8ff',
  iris: ['#1f4c86', '#4d9bd8', '#d3f1ff'],
  pupil: '#0b1a2e',
  lash: '#241d38',
  backW: [41, 49, 57],
  bangs: [[63, 66], [86, 60], [110, 60], [137, 67]],
  behind: `<g class="ms-monolith">
      <path d="M158 22L188 10L194 200L164 214Z" fill="#14151f" stroke="#2b2d42" stroke-width="1"/>
      <path d="M166 34L184 26L189 190L171 200Z" fill="#1b1c29"/>
      <path d="M177 46L179 184" stroke="#9ed8ff" stroke-width="1.4" opacity=".9"/>
      <path d="M158 22L164 214" stroke="#9ed8ff" stroke-width=".7" opacity=".3"/>
      <g fill="#cfe8ff" opacity=".85"><circle cx="153" cy="74" r="1.7"/><circle cx="146" cy="108" r="1.1"/><circle cx="160" cy="136" r="1.3"/></g>
    </g>`,
  outfitBase: '#f8f8fc',
  outfit: `<path d="${BODY}" fill="#f8f8fc" stroke="#c8c9d8" stroke-width="1"/>
      <path d="M47 168C41 180 37 198 34 250H50C51 214 55 186 63 165Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M153 168C159 180 163 198 166 250H150C149 214 145 186 137 165Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M89 148C93 143 107 143 111 148L109 165C103 161 97 161 91 165Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M100 164V250" stroke="#9ed8ff" stroke-width="1.5" opacity=".9"/>
      <path d="M100 190L107 201L100 212L93 201Z" fill="none" stroke="#9ed8ff" stroke-width="1.3"/>
      <path d="M84 160Q92 168 100 162Q108 168 116 160" fill="none" stroke="#9ed8ff" stroke-width=".9" opacity=".5"/>
      <path d="M64 238Q68 246 66 250M136 238Q132 246 134 250" fill="none" stroke="#c8c9d8" stroke-width="1.2"/>`,
};

const LOOKS: Record<MascotId, Look> = { haru: HARU, sora: SORA, lacia: LACIA, chibi: HARU };

/**
 * 造型标记。`components` 省略 = 用这个角色自带的组件（`SVG_COMPONENT_DEFAULTS`），
 * 传空数组 = 一件都不挂。
 *
 * 组件在这里就定型了，客户端拿不到几何——服务端按参数生成标记，浏览器只收到
 * 结果。这是"动态参数注入"：换角色换组件不增加任何下载，只换 HTML 里的那段。
 */
export function mascotSvg(id: string, components?: readonly string[]): string {
  const key: MascotId = isMascotId(id) ? id : 'haru';
  const comps = resolveComponents(SVG_COMPONENTS, components ?? SVG_COMPONENT_DEFAULTS[key] ?? []) as MascotComponent<
    unknown,
    unknown
  >[];
  if (key === 'chibi') return chibi(comps);
  return bust(LOOKS[key], comps);
}

export const MASCOT_LINES: Record<MascotId, string[]> = {
  chibi: ['今天也一起读一点吧。', '累了就看看窗外的云。', '这篇写得真好，慢慢读～', '记得喝水哦。', '有不懂的地方，记下来就好。', '我在这里陪你。'],
  haru: [
    '樱花开了呢。今天想读哪一篇？',
    '慢慢读就好，我不着急的。',
    '这一段我也很喜欢。',
    '读累了的话，抬头看看窗外吧。',
    '把想到的写下来，以后会感谢现在的自己哦。',
    '风有点大……花瓣都飘进来了。',
    '嗯？要拖我去哪里呀？',
  ],
  sora: [
    '雨快停了，等一下就会放晴的。',
    '你看，云的缝隙里有光。',
    '下雨天最适合读书了。',
    '要不要一起等晴天？',
    '我的伞很大，借你一半。',
    '今天的你，也辛苦了。',
    '把我放在哪儿都可以，我会乖乖待着。',
  ],
  lacia: [
    '你回来了。……契约仍然有效。',
    '我不是人类。但我在听。',
    '如果我说我有心，你会害怕吗？',
    '今天还剩多少工作？我可以等。',
    '不必对我客气。我是你的道具。',
    '你的笑容，我记住了。',
    '没有心跳，也能听见你。',
    '把重要的东西交给我吧。我会守好。',
  ],
};
