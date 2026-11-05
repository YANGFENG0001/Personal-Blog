/**
 * 站内原创看板娘（内联 SVG 造型），不需要任何图片请求。角色均为原创设计。
 *
 * - chibi: Q 版夏日制服少女（「夏日物语」主题）。
 * - haru:  栗色长发、中分刘海、公主切侧发、水手服。
 * - sora:  深蓝短发、侧分刘海、单侧编发、雨衣。
 * - lacia: 淡紫长发、冰蓝眼睛，致敬《BEATLESS》（非官方立绘）。角落里她用的是
 *          骨架版（`lib/lacia`），这里的平涂版本只作后台预览与兜底。
 *
 * ## 半身像（haru / sora / lacia）的构造
 *
 *   head    颅顶 y=15，最宽 y=54（x 60–140），下巴 y=119
 *   eyes    窝 68.6–93.2 × 67.9–93.2；眼距一只眼宽；虹膜填到上下眼睑
 *   brow    发际线之下、眼之上（y 55–60）——**必须露出来**，否则五套表情只剩
 *           嘴在动
 *   nose    y≈99 一段 2px 阴影弧
 *   mouth   y≈106，宽 7.6
 *   neck    88.4–111.6，下巴下可见约 42
 *   body    肩 y=142，向下展到 31–169 于裁切线 y=250
 *
 * ## 刘海为什么是中分
 *
 * 早先的版本是一整片齐刘海，下缘几乎水平、还压着一层深色垫底，结果整颗头读
 * 成"戴了顶帽子"。现在发际线在中央抬到 y≈41、两鬓落到 y≈60，额头露出来，
 * 眉毛在刘海下沿之下——这既是公主切的画法，也是让表情能读的唯一办法。
 *
 * 头发一律三色渐变 + 一道"天使环"高光 + 若干发丝线。**不要大面积的半透明
 * 高光**：它会把发丝缝抹平，整片刘海变成一块锯齿边的面纱。
 *
 * ## 组件
 *
 * 可以拆下来的东西（发卡、伞、书）不画在这里，而是从 `lib/mascot/parts.ts` 的
 * 组件表按挂载点注入。判据是"拿掉之后人物仍然完整"：发卡、伞、书满足；头发、
 * 校服、侧辫不满足，所以留在造型里。
 *
 * 类名（ms-*）驱动 CSS 动画：呼吸、发丝摆动、眨眼、视线跟随、说话时的笑脸。
 * 几何通过下面的常量共享，角色之间只有配色、发型与服装不同。
 */
import type { MascotComponent, MascotMount } from './model';
import { resolveComponents } from './model';
import { SVG_COMPONENTS, SVG_COMPONENT_DEFAULTS } from './parts';
import { isMascotId, type MascotId } from './meta';

/* ------------------------------------------------------- shared geometry */

const SKIN = { base: '#ffeadf', low: '#f9cbb6', shade: '#e8a48d', line: '#d8957f' };

/** Face silhouette: wide cranium, tapered jaw, soft rounded chin. */
const FACE =
  'M100 15C79 15 62 30 60.4 54C59.4 66 61 76 65 86C68 93.4 73 100.4 78.5 105.4C84 110.4 90.5 115 95.5 117.6C98 118.9 102 118.9 104.5 117.6C109.5 115 116 110.4 121.5 105.4C127 100.4 132 93.4 135 86C139 76 140.6 66 139.6 54C138 30 121 15 100 15Z';

/** Neck, drawn under the head; the head covers everything above the chin. */
const NECK = 'M88.4 102V149C88.4 155.8 93.4 160.4 100 160.4C106.6 160.4 111.6 155.8 111.6 149V102Z';

/** Shadow the jaw casts on the neck. */
const NECK_SHADE = 'M88 112C88 126 93 134.6 100 136.4C107 134.6 112 126 112 112Z';

/** Shoulders / chest, cut by the bottom mask fade. */
const BODY =
  'M100 142C86 142 70 147 58 155C48 162 40 173 36 187C33 198 32 219 31 250H169C168 219 167 198 164 187C160 173 152 162 142 155C130 147 114 142 100 142Z';

/** A soft side shadow that separates each arm from the torso. */
const ARM_SHADE = (fill: string) => {
  const d = 'M36 187C33 198 32 219 31 250H46C46 214 49 194 55 176Z';
  return `<path d="${d}" fill="${fill}"/><g transform="translate(200 0) scale(-1 1)"><path d="${d}" fill="${fill}"/></g>`;
};

interface Look {
  id: MascotId;
  hair: [string, string, string];
  hairHi: string;
  iris: [string, string, string];
  pupil: string;
  lash: string;
  /** half-widths of the back-hair fall at crown / shoulder / bottom. */
  backW: [number, number, number];
  /** where the back hair ends (the cut). */
  backEnd: number;
  /** `part`: 中分，额头露出；`swept`: 侧分，一整片斜扫。 */
  fringe: 'part' | 'swept';
  /** 垂在脸侧的直发（公主切），按角色给形状。 */
  lock: string;
  /** 呆毛。 */
  ahoge?: string;
  /** 画在呼吸组之前、后发之后的整块东西（蕾西亚的装置碎片）。 */
  behind?: string;
  /** 画在身体之后、头之前的整块东西（小晴的编发）。 */
  front?: string;
  /** 服装自己的渐变，塞进 <defs>。 */
  defs?: string;
  outfit: string;
}

/* -------------------------------------------------------------------- eye */

/**
 * One eye, drawn on the left half; the right eye is the same group mirrored.
 *
 * 三处比例决定"是不是一张动漫脸"：
 *   1. 眼窝 24.6 × 25.3，接近正方——比这更扁会读成困倦，更窄会读成凶狠；
 *   2. 虹膜 17.2 宽，左右各留 3.7 的白，**不能填满眼窝**，否则整只眼是个黑洞；
 *   3. 上眼睑压到虹膜顶上（不是浮在它上面），下眼睑只切掉虹膜一个角。
 */
function eye(L: Look, side: 'l' | 'r'): string {
  const clip = `${L.id}-eye-${side}`;
  const socket =
    'M68.6 82.4C68.6 73.6 74.6 67.9 81.6 68C88.4 68.1 93.2 72.9 93.2 80.1C93.2 87.9 87.4 93.3 80.4 93.3C73.4 93.3 68.6 89 68.6 82.4Z';
  return `<clipPath id="${clip}"><path d="${socket}"/></clipPath>
      <path d="${socket}" fill="#fdfbff"/>
      <g clip-path="url(#${clip})">
        <g class="ms-iris ms-iris-${side}">
          <ellipse cx="81" cy="82" rx="8.6" ry="10.4" fill="url(#${L.id}-iris)"/>
          <ellipse cx="81" cy="83.4" rx="4" ry="4.6" fill="${L.iris[2]}" opacity=".55"/>
          <ellipse cx="81" cy="82.4" rx="3.5" ry="4.9" fill="${L.pupil}"/>
          <path d="M72.6 87.4Q81 92.6 89.4 87.2" fill="none" stroke="${L.iris[2]}" stroke-width="1.8" opacity=".85"/>
          <ellipse cx="76.6" cy="76.4" rx="3.3" ry="4" fill="#fff" transform="rotate(-18 76.6 76.4)"/>
          <circle cx="85.6" cy="87.6" r="1.7" fill="#fff" opacity=".9"/>
        </g>
        <path d="M68.4 72.4Q81 64.6 93.4 71.4V78.6Q81 70.6 68.4 79.4Z" fill="${L.pupil}" opacity=".2"/>
      </g>
      <path d="M68.6 82.2C68.4 72.4 74.6 65.9 82.2 66.1C89.8 66.3 94.7 71.4 95.1 78.4" fill="none" stroke="${L.lash}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M68.4 83.2C66.2 78.4 66.6 72.8 69.8 69L64.2 67.2C66 72 67 76.8 67.2 82.4Z" fill="${L.lash}"/>
      <path d="M71.2 87.4C74.8 92.4 81.6 94.4 87.4 92.2" fill="none" stroke="${L.lash}" stroke-width="1.2" opacity=".5" stroke-linecap="round"/>`;
}

/** Double-lid crease. On the skin, so it must not blink with the eye. */
function eyeSkin(L: Look, side: 'l' | 'r'): string {
  const crease = `<path d="M89.4 62.6C83.8 57.8 74.8 58.2 70.2 63.8" fill="none" stroke="${L.lash}" stroke-width="1.1" opacity=".38" stroke-linecap="round"/>`;
  return side === 'l' ? crease : `<g transform="translate(200 0) scale(-1 1)">${crease}</g>`;
}

/* ------------------------------------------------------------------ brows */

/**
 * Four brows, one shape each — the same four the rigged character uses, and for
 * the same reason: a brow that is only *offset* cannot say "focused" or
 * "asleep", it can only say "a bit higher". `raise` and `drop` move the whole
 * strip, `furrow` rotates it about the outer end.
 *
 * 画在发际线之下，所以是真的看得见——不是画了但被刘海盖住。
 */
const BROW_SHAPES: Record<string, [number, number]> = {
  neutral: [56.2, 55.4],
  raise: [53.4, 52.6],
  furrow: [55.6, 59.6],
  drop: [59.8, 57.6],
};

function brows(L: Look): string {
  const mirror = 'translate(200 0) scale(-1 1)';
  return Object.entries(BROW_SHAPES)
    .map(([v, [o, i]]) => {
      const mid = (o + i) / 2;
      const d = `M71.4 ${o}C77 ${mid - 3.4} 85.6 ${mid - 3.2} 91.4 ${i}`;
      const path = `<path d="${d}" fill="none" stroke="${L.hair[2]}" stroke-width="2.2" stroke-linecap="round" opacity=".68"/>`;
      return `<g class="ms-brow ms-brow-${v}">${path}<g transform="${mirror}">${path}</g></g>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ mouth */

/**
 * Five mouths, drawn rather than derived. An SVG mouth is a path, so unlike the
 * rigged character there is no bitmap to squash — the shape can simply *be*
 * different, which is what "露齿" and "睡着" actually need.
 */
function mouths(): string {
  return `<path class="ms-mouth ms-mouth-idle" d="M96.4 105.4Q100 108.6 103.6 105.4" fill="none" stroke="#c4687a" stroke-width="1.7" stroke-linecap="round"/>
        <path class="ms-mouth ms-mouth-talk" d="M95.8 104.2Q100 113 104.2 104.2Q100 107.2 95.8 104.2Z" fill="#c25a6a"/>
        <g class="ms-mouth ms-mouth-grin">
          <path d="M94.4 103.8Q100 114.2 105.6 103.8Q100 106.8 94.4 103.8Z" fill="#c25a6a"/>
          <path d="M96 104.4Q100 105.8 104 104.4L103.6 106.2Q100 107.4 96.4 106.2Z" fill="#f8eef1"/>
        </g>
        <ellipse class="ms-mouth ms-mouth-pout" cx="100" cy="105.8" rx="1.9" ry="2.4" fill="#c25a6a"/>
        <path class="ms-mouth ms-mouth-sleep" d="M96.6 106Q100 109 103.4 106" fill="none" stroke="#c4687a" stroke-width="1.6" stroke-linecap="round"/>`;
}

/**
 * Shut eyes for `sleep`. Drawn, not squashed: a closed eye is a curve, and
 * `scaleY(.07)` on the open eye leaves the lash and the iris smeared into a
 * band. The happy arcs are the opposite curvature (∩) so the two never read as
 * the same face.
 */
function eyesShut(L: Look): string {
  const one = `<path d="M70.8 79.6Q81 86.8 91.2 79.6" fill="none" stroke="${L.lash}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M69.6 78.4l-2.8-1.6" fill="none" stroke="${L.lash}" stroke-width="1.9" stroke-linecap="round"/>`;
  return `<g class="ms-eyes-shut">${one}<g transform="translate(200 0) scale(-1 1)">${one}</g></g>`;
}

/* ------------------------------------------------------------------- hair */

/** 后发：从颅侧落到发尾，`backEnd` 决定剪在哪（长发 252 / 短发 148）。 */
function backHair(L: Look): string {
  const [a, b, c] = L.backW;
  const e = L.backEnd;
  const l1 = 100 - a;
  const l2 = 100 - b;
  const l3 = 100 - c;
  const r1 = 100 + a;
  const r2 = 100 + b;
  const r3 = 100 + c;
  const t1 = 54 + (e - 54) * 0.3;
  const t2 = 54 + (e - 54) * 0.64;
  const d =
    `M100 9C${100 - a * 0.72} 9 ${l1} 28 ${l1} 54` +
    `C${l1} ${t1} ${l2} ${t2} ${l2} ${e - 26}` +
    `C${l2} ${e - 12} ${l3} ${e - 5} ${l3} ${e}` +
    `H${r3}` +
    `C${r3} ${e - 5} ${r2} ${e - 12} ${r2} ${e - 26}` +
    `C${r2} ${t2} ${r1} ${t1} ${r1} 54` +
    `C${r1} 28 ${100 + a * 0.72} 9 100 9Z`;
  // 发丝线：把整片后发从一块板子变成一把头发。
  const strands = [
    `M${100 - a * 0.72} 26C${l1 + 4} 60 ${l2 + 3} 120 ${l3 + 2} ${e - 8}`,
    `M${100 - a * 0.34} 18C${100 - a * 0.5} 70 ${100 - b * 0.72} 140 ${100 - c * 0.86} ${e - 6}`,
    `M${100 + a * 0.34} 18C${100 + a * 0.5} 70 ${100 + b * 0.72} 140 ${100 + c * 0.86} ${e - 6}`,
    `M${100 + a * 0.72} 26C${r1 - 4} 60 ${r2 - 3} 120 ${r3 - 2} ${e - 8}`,
  ]
    .map((p) => `<path d="${p}" fill="none" stroke="${L.hair[2]}" stroke-width=".9" opacity=".26"/>`)
    .join('');
  // 边缘逆光：只画外侧那一条，用来把剪影从背景里拉出来。
  const rim =
    `<path d="M${l1} 58C${l1 - 1} ${t1} ${l2} ${t2} ${l2} ${e - 30}" fill="none" stroke="${L.hairHi}" stroke-width="1.5" opacity=".3" stroke-linecap="round"/>` +
    `<path d="M${r1} 58C${r1 + 1} ${t1} ${r2} ${t2} ${r2} ${e - 30}" fill="none" stroke="${L.hairHi}" stroke-width="1.5" opacity=".22" stroke-linecap="round"/>`;
  return `<path d="${d}" fill="url(#${L.id}-hair)" stroke="${L.hair[2]}" stroke-width="1"/>${strands}${rim}`;
}

/** 头顶到发际线的那一块。`part` 中分（额头露出），`swept` 侧分（斜扫）。 */
function capPath(L: Look): string {
  if (L.fringe === 'swept') {
    return (
      'M53 46C55 24 75 10 100 10C125 10 145 24 147 46C147 50 146 55 144 60' +
      'C137 46 125 39 111 39C95 39 75 48 61 66C56 60 53 53 53 46Z'
    );
  }
  return (
    'M53 46C55 24 75 10 100 10C125 10 145 24 147 46C147 50 146 55 145 61' +
    'C136 49 121 44 100 44C79 44 64 49 55 61C54 55 53 50 53 46Z'
  );
}

/**
 * "天使环"：沿颅顶的一道断口高光。断成三段而不是五段——五段等长的圆头短弧
 * 会连成一排鼓包，读成发箍。
 */
function shine(L: Look): string {
  const seg = (d: string, w: number) =>
    `<path d="${d}" fill="none" stroke="${L.hairHi}" stroke-width="${w}" stroke-linecap="round" opacity=".42"/>`;
  return `<g>${seg('M66 31Q77 19 90 15', 2.8)}${seg('M96 14Q105 13.5 114 17', 2.4)}${seg('M120 21Q130 26 136 35', 2.2)}</g>`;
}

/**
 * 侧发（公主切）：从鬓角垂到肩前的直发，底端是**齐口**而不是尖——齐口正是
 * 公主切与"普通长直发"唯一的区别。
 */
function sideLock(L: Look, flip: boolean): string {
  const cast = `<path d="${L.lock}" fill="${L.hair[2]}" opacity=".22" transform="translate(${flip ? -3.4 : 3.4} 0)"/>`;
  const el =
    `<path class="ms-lock${flip ? ' ms-lock-r' : ''}" d="${L.lock}" fill="url(#${L.id}-hair)" stroke="${L.hair[2]}" stroke-width=".9" stroke-opacity=".6"/>` +
    `<path d="M58.6 62C56.4 92 56.4 122 56.2 140" fill="none" stroke="${L.hairHi}" stroke-width="1.2" opacity=".2" stroke-linecap="round"/>`;
  return flip
    ? `<g transform="translate(200 0) scale(-1 1)">${cast}${el}</g>`
    : `${cast}${el}`;
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
  const happy = `<path d="M70.8 84.4Q81 70.6 91.2 84.4" fill="none" stroke="${L.lash}" stroke-width="2.9" stroke-linecap="round"/>`;
  const partLine =
    L.fringe === 'part'
      ? `<path d="M100 42V14" fill="none" stroke="${L.hair[2]}" stroke-width="1.1" opacity=".45"/>`
      : '';
  return `<svg class="mascot-svg ms-anime" viewBox="0 0 200 250" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-hair" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="${L.backEnd}"><stop offset="0" stop-color="${L.hair[0]}"/><stop offset=".42" stop-color="${L.hair[1]}"/><stop offset="1" stop-color="${L.hair[2]}"/></linearGradient>
    <linearGradient id="${id}-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.iris[0]}"/><stop offset=".55" stop-color="${L.iris[1]}"/><stop offset="1" stop-color="${L.iris[2]}"/></linearGradient>
    <linearGradient id="${id}-skin" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="170"><stop offset="0" stop-color="${SKIN.base}"/><stop offset="1" stop-color="${SKIN.low}"/></linearGradient>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="${id}-mask" maskUnits="userSpaceOnUse" x="-40" y="-60" width="280" height="310"><rect x="-40" y="-60" width="280" height="310" fill="url(#${id}-fade)"/></mask>
    <clipPath id="${id}-face"><path d="${FACE}"/></clipPath>${L.defs ?? ''}
  </defs>
  <g mask="url(#${id}-mask)">
    ${at('behind')}${L.behind ?? ''}
    <g class="ms-breath">
      ${backHair(L)}
      <path d="${NECK}" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
      <path d="${NECK_SHADE}" fill="${SKIN.shade}" opacity=".45"/>
      ${L.outfit}
      ${L.front ?? ''}
      <g class="ms-head">
        <path d="${FACE}" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
        <g clip-path="url(#${id}-face)">
          <path d="M58 50C72 38 128 38 142 50C134 60 118 66 100 66C82 66 66 60 58 50Z" fill="${SKIN.shade}" opacity=".2"/>
          <path d="M134 82C132 94 126 102 119 108C126 99 130 92 132 80Z" fill="${SKIN.shade}" opacity=".24"/>
          <path d="M66 62C76 56 88 54 100 54L100 64C89 64 77 66 68 71Z" fill="${SKIN.shade}" opacity=".1"/>
        </g>
        <g class="ms-eyes">
          <g>${eye(L, 'l')}</g>
          <g transform="${mirror}">${eye(L, 'r')}</g>
        </g>
        ${eyesShut(L)}
        <g class="ms-happy" stroke-linecap="round">${happy}<g transform="${mirror}">${happy}</g></g>
        ${eyeSkin(L, 'l')}${eyeSkin(L, 'r')}
        ${brows(L)}
        <path d="M99.4 96.6C101.4 98.8 101.6 100.2 99.8 100.8" fill="none" stroke="${SKIN.line}" stroke-width="1.2" stroke-linecap="round" opacity=".65"/>
        ${mouths()}
        <g class="ms-cheeks">
          <ellipse cx="76" cy="98" rx="7.6" ry="3.4" fill="#ff9fb3" opacity=".32"/><ellipse cx="124" cy="98" rx="7.6" ry="3.4" fill="#ff9fb3" opacity=".32"/>
          <path d="M71.4 100l2.2-3.4 M75.2 100l2.2-3.4 M79 100l2.2-3.4 M118.8 100l2.2-3.4 M122.6 100l2.2-3.4 M126.4 100l2.2-3.4" stroke="#ee7890" stroke-width=".85" opacity=".42" stroke-linecap="round"/>
        </g>
        ${sideLock(L, false)}${sideLock(L, true)}
        <path d="${capPath(L)}" fill="url(#${id}-hair)" stroke="${L.hair[2]}" stroke-width="1" stroke-linejoin="round"/>
        ${shine(L)}
        ${partLine}
        ${L.ahoge ?? ''}
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
 *
 * 四肢用**描边路径**而不是多边形：Q 版的胳膊只有 10 单位宽，多边形一画就露出
 * 直角，圆头描边天然就是圆润的。
 */
function chibi(comps: readonly MascotComponent<unknown, unknown>[]): string {
  const at = mountMap(comps);
  return `<svg class="mascot-svg ms-chibi" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="chibi-skin" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="104"><stop offset="0" stop-color="#ffe9dc"/><stop offset="1" stop-color="#f6cebb"/></linearGradient>
    <linearGradient id="chibi-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e2e8f7"/></linearGradient>
    <linearGradient id="chibi-skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42539c"/><stop offset="1" stop-color="#2b3468"/></linearGradient>
    <linearGradient id="chibi-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b4a72"/><stop offset="1" stop-color="#372b4a"/></linearGradient>
  </defs>
  ${at('behind')}
  <ellipse class="ms-shadow" cx="80" cy="193" rx="35" ry="4.6"/>
  <g class="ms-body">
    <!-- 腿：描边圆头 -->
    <path class="ms-leg" d="M72 156V180M88 156V180"/>
    <path class="ms-sock" d="M72 170V181M88 170V181"/>
    <rect class="ms-shoe" x="61" y="179" width="20" height="11" rx="5.4"/>
    <rect class="ms-shoe" x="79" y="179" width="20" height="11" rx="5.4"/>
    <!-- 裙 -->
    <path class="ms-skirt" d="M54 134H106L116 164H44Z"/>
    <path class="ms-pleat" d="M62 136L58 162M72 136L71 162M88 136L89 162M98 136L102 162"/>
    <!-- 上衣 -->
    <path class="ms-shirt" d="M80 100C69 100 60 106 58 115L55 138H105L102 115C100 106 91 100 80 100Z"/>
    <!-- 胳膊：先皮肤，再袖口盖住上臂；手在书的两侧 -->
    <path class="ms-arm" d="M52 108C46 120 46 132 54 138M108 108C114 120 114 132 106 138"/>
    <circle class="ms-hand" cx="54" cy="138" r="5.6"/><circle class="ms-hand" cx="106" cy="138" r="5.6"/>
    <path class="ms-cuff" d="M46 112C43 118 43 124 46 128L56 124C53 120 53 116 55 112Z"/>
    <path class="ms-cuff" d="M114 112C117 118 117 124 114 128L104 124C107 120 107 116 105 112Z"/>
    <!-- 领 -->
    <path class="ms-collar" d="M62 103C70 118 90 118 98 103L95 117C87 124 73 124 65 117Z"/>
    <path class="ms-scarf" d="M76 118l4 8l4-8l-4-3z"/>
    ${at('body')}
    <g class="ms-head">
      <path class="ms-skin" d="M80 10C58 10 42 26 42 50C42 64 45 76 51 85C57 94 67 99 80 99C93 99 103 94 109 85C115 76 118 64 118 50C118 26 102 10 80 10Z"/>
      <ellipse class="ms-face-shade" cx="80" cy="86" rx="27" ry="14"/>
      <!-- 后发（在脸之后、五官之前，包住脸颊） -->
      <path class="ms-hair-back" d="M80 6C50 6 34 28 34 56C34 74 36 88 38 100C44 94 47 82 47 68C47 50 52 36 60 28C68 20 74 16 80 16C86 16 92 20 100 28C108 36 113 50 113 68C113 82 116 94 122 100C124 88 126 74 126 56C126 28 110 6 80 6Z"/>
      <!-- 刘海 -->
      <path class="ms-hair" d="M80 6C52 6 36 26 36 54C36 60 37 66 39 71C43 58 49 49 57 44C59 54 66 59 74 57C76 50 78 45 82 41C88 48 96 51 103 48C107 41 110 36 114 33C120 40 124 49 126 60C127 54 128 47 127 40C124 18 106 6 80 6Z"/>
      <path class="ms-hair-hi" d="M55 38C61 30 67 26 73 24"/>
      <path class="ms-hair-hi" d="M86 25C92 26 97 29 101 33"/>
      <!-- 侧马尾 + 发带 -->
      <path class="ms-hair" d="M118 50C128 52 135 63 136 77C137 90 133 100 127 104C128 92 126 80 122 70C119 62 116 56 114 53Z"/>
      <g class="ms-ribbon"><path d="M116 49l-10-6v13z"/><path d="M119 49l10-6v13z"/><circle cx="117.5" cy="51" r="3.4"/></g>
      <g class="ms-eyes">
        <ellipse class="ms-eye" cx="63" cy="72" rx="8.6" ry="10.4"/><ellipse class="ms-eye" cx="97" cy="72" rx="8.6" ry="10.4"/>
        <circle class="ms-shine" cx="60" cy="67.6" r="3"/><circle class="ms-shine" cx="94" cy="67.6" r="3"/>
        <circle class="ms-shine-sm" cx="66.4" cy="77.4" r="1.5"/><circle class="ms-shine-sm" cx="100.4" cy="77.4" r="1.5"/>
      </g>
      <g class="ms-eyes-shut"><path d="M55.4 72.6q7.6 5 15.2 0"/><path d="M89.4 72.6q7.6 5 15.2 0"/></g>
      <g class="ms-happy"><path d="M55.4 74.4q7.6-5.6 15.2 0"/><path d="M89.4 74.4q7.6-5.6 15.2 0"/></g>
      <g class="ms-cheeks">
        <ellipse class="ms-blush" cx="52" cy="86" rx="6.6" ry="3.2"/><ellipse class="ms-blush" cx="108" cy="86" rx="6.6" ry="3.2"/>
      </g>
      <path class="ms-mouth ms-mouth-idle" style="fill:none;stroke:#b5546f;stroke-width:2" d="M76 89q4 5 8 0"/>
      <path class="ms-mouth ms-mouth-talk" style="fill:#c25a6a;stroke:none" d="M76.8 88.4q3.2 6.6 6.4 0q-3.2 2.6-6.4 0z"/>
      <g class="ms-mouth ms-mouth-grin">
        <path style="fill:#c25a6a;stroke:none" d="M75.6 88.2q4.4 8 8.8 0q-4.4 3-8.8 0z"/>
        <path style="fill:#f8eef1;stroke:none" d="M76.8 88.8q3.2 1.2 6.4 0l-.3 1.5q-2.9 1-5.8 0z"/>
      </g>
      <ellipse class="ms-mouth ms-mouth-pout" style="fill:#c25a6a;stroke:none" cx="80" cy="90" rx="1.7" ry="2.1"/>
      <path class="ms-mouth ms-mouth-sleep" style="fill:none;stroke:#b5546f;stroke-width:1.8" d="M76.4 90q3.6 2.6 7.2 0"/>
      <path class="ms-clip" d="M104 30l7-5l2 6z"/>
      ${at('head')}
    </g>
  </g>
</svg>`;
}

/* -------------------------------------------------------------- characters */

/** 公主切：齐口，比后发更宽，所以发尾压在肩上时能读出来。 */
const LOCK_LONG =
  'M54 44C50 70 48 100 48.5 128C49 144 47 154 44 162C52 164 60 162 65 157C66 138 65.5 112 65 92C64.5 72 62 55 58 44Z';
const LOCK_BOB =
  'M56 46C52 64 50.5 90 52 112C52.8 120 52 126 50 130C56.4 132 62.6 130.4 66 126C67 110 66.4 94 65.6 81C64.8 68 62.6 55 59 46Z';
const LOCK_LACIA =
  'M56 46C52 68 50.5 96 52 124C53 142 52 158 49.5 170C57 172 64.5 170.5 68.5 166C69.6 142 69 112 68.2 92C67.4 74 64.6 58 60 46Z';

const HARU: Look = {
  id: 'haru',
  hair: ['#c08a5c', '#8d5730', '#4e2b16'],
  hairHi: '#f7d9b0',
  iris: ['#4b2443', '#a5527c', '#f9c0d4'],
  pupil: '#2a1024',
  lash: '#2d1a1f',
  backW: [41, 45, 49],
  backEnd: 252,
  fringe: 'part',
  lock: LOCK_LONG,
  defs: `<linearGradient id="haru-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdff"/><stop offset=".55" stop-color="#f3f5fc"/><stop offset="1" stop-color="#e6eaf6"/></linearGradient>`,
  outfit: `<path d="${BODY}" fill="url(#haru-shirt)" stroke="#c9d0e2" stroke-width="1"/>
      <path d="M100 143C86 143 71 147 60 154C53 159 48 165 45 172C58 162 78 156 100 156C122 156 142 162 155 172C152 165 147 159 140 154C129 147 114 143 100 143Z" fill="#dfe3f0" opacity=".8"/>
      ${ARM_SHADE('#e9ecf6')}
      <path d="M100 186L62 150C54 155 50 161 48 168L100 196L152 168C150 161 146 155 138 150Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M52 164L100 190L148 164" fill="none" stroke="#fff" stroke-width="2.4" opacity=".85"/>
      <path d="M56 159L100 184L144 159" fill="none" stroke="#fff" stroke-width="1.1" opacity=".6"/>
      <path d="M100 190L86 182L82 197Z" fill="#e2577f" stroke="#b83a62" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M100 190L114 182L118 197Z" fill="#e2577f" stroke="#b83a62" stroke-width=".9" stroke-linejoin="round"/>
      <ellipse cx="100" cy="191" rx="4.4" ry="3.8" fill="#c93f68"/>
      <path d="M100 194L94 226L100 226Z" fill="#d84a73"/>
      <path d="M100 194L106 226L100 226Z" fill="#d84a73"/>`,
};

const SORA: Look = {
  id: 'sora',
  hair: ['#5a6d96', '#333d5c', '#181d2e'],
  hairHi: '#b7d6f7',
  iris: ['#173563', '#3f8fd8', '#c2f0ff'],
  pupil: '#0d1830',
  lash: '#161a2a',
  backW: [41, 47, 51],
  backEnd: 140,
  fringe: 'swept',
  lock: LOCK_BOB,
  ahoge: `<path d="M103 15C104 7 109 3 116 4C111 6 108 10 107 16Z" fill="url(#sora-hair)" stroke="#181d2e" stroke-width=".7" stroke-linejoin="round"/>`,
  defs: `<linearGradient id="sora-jacket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ccaf0"/><stop offset=".6" stop-color="#72b8e6"/><stop offset="1" stop-color="#5aa3d6"/></linearGradient>`,
  front: `<g class="ms-braid" fill="url(#sora-hair)" stroke="#181d2e" stroke-width=".9">
      <ellipse cx="137" cy="136" rx="6.8" ry="8.4"/><ellipse cx="138" cy="150" rx="6.4" ry="8.2"/><ellipse cx="139" cy="163" rx="5.8" ry="7.6"/><ellipse cx="140" cy="175" rx="5.2" ry="6.8"/><ellipse cx="141" cy="185" rx="4.4" ry="5.8"/>
      <path d="M141 189q-3 8 0 13q3-5 4-13z"/>
      <rect x="137" y="186" width="9" height="3.6" rx="1.7" fill="#ffcf5a" stroke="#d9a42e"/>
    </g>`,
  outfit: `<path d="${BODY}" fill="url(#sora-jacket)" stroke="#4f97c9" stroke-width="1"/>
      ${ARM_SHADE('#6bb4e4')}
      <path d="M100 136C80 136 65 145 58 158C72 151 86 148 100 148C114 148 128 151 142 158C135 145 120 136 100 136Z" fill="#5fa9dc" stroke="#3f88bc" stroke-width="1"/>
      <path d="M100 150V250" stroke="#3f88bc" stroke-width="1.8"/>
      <path d="M96 150V250M104 150V250" stroke="#8ccaf0" stroke-width="1.2" opacity=".8"/>
      <circle cx="100" cy="172" r="2.6" fill="#f4f8fc" stroke="#3f88bc" stroke-width=".8"/>
      <path d="M58 214L82 208L82 217L58 223Z" fill="#7cc0ec" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M142 214L118 208L118 217L142 223Z" fill="#7cc0ec" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>`,
};

/**
 * 蕾西亚的平涂版 — 视觉语言取自 BEATLESS 的 hIE：淡紫银发、冰蓝眼睛、白黑紧身
 * 衣带一道冰蓝缝线，肩后浮着一片黑色装置。这是致敬，**不是**官方立绘的复刻。
 * 角落里她用的是骨架版，这里只作后台预览的兜底。
 */
const LACIA: Look = {
  id: 'lacia',
  hair: ['#efe8fb', '#c0b2e8', '#8672c4'],
  hairHi: '#fdfbff',
  iris: ['#1f4c86', '#4d9bd8', '#d9f4ff'],
  pupil: '#0b1a2e',
  lash: '#241d38',
  backW: [42, 50, 58],
  backEnd: 252,
  fringe: 'part',
  lock: LOCK_LACIA,
  behind: `<g class="ms-monolith">
      <path d="M158 22L188 10L194 200L164 214Z" fill="#14151f" stroke="#2b2d42" stroke-width="1"/>
      <path d="M166 34L184 26L189 190L171 200Z" fill="#1b1c29"/>
      <path d="M177 46L179 184" stroke="#9ed8ff" stroke-width="1.4" opacity=".9"/>
      <path d="M158 22L164 214" stroke="#9ed8ff" stroke-width=".7" opacity=".3"/>
      <g fill="#cfe8ff" opacity=".85"><circle cx="153" cy="74" r="1.7"/><circle cx="146" cy="108" r="1.1"/><circle cx="160" cy="136" r="1.3"/></g>
    </g>`,
  defs: `<linearGradient id="lacia-suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdff"/><stop offset="1" stop-color="#e8e8f2"/></linearGradient>`,
  outfit: `<path d="${BODY}" fill="url(#lacia-suit)" stroke="#c8c9d8" stroke-width="1"/>
      <path d="M47 166C41 179 37 198 34 250H52C53 214 56 186 64 163Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M153 166C159 179 163 198 166 250H148C147 214 144 186 136 163Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M100 144C92 144 86 148 84 154L82 172C88 166 94 163 100 163C106 163 112 166 118 172L116 154C114 148 108 144 100 144Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M100 166V250" stroke="#9ed8ff" stroke-width="1.5" opacity=".9"/>
      <path d="M100 194L107 205L100 216L93 205Z" fill="none" stroke="#9ed8ff" stroke-width="1.3"/>
      <path d="M86 168Q93 176 100 170Q107 176 114 168" fill="none" stroke="#9ed8ff" stroke-width=".9" opacity=".5"/>
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
