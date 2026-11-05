/**
 * 内联 SVG 造型的可选组件。
 *
 * 三个内置造型（小春 / 小晴 / Q 版）本来就是一张内联 SVG，五官与服装都画死
 * 在里面。这套文件把**可以拆下来的东西**拆出来，让它们走和骨架同一套组件表：
 *
 *   sakura    樱花发卡    头饰    小春
 *   sunclip   太阳发夹    头饰    小晴
 *   umbrella  透明雨伞    背部    小晴   自带动作：转伞
 *   book      手里的书    手持    Q 版   被抱起 / 睡着时收起
 *
 * 拆出来的判据不是"好看"而是**能不能独立存在**：发卡、伞、书拿掉之后人物仍然
 * 完整；而头发、校服、侧辫拿掉就是残肢，所以它们留在造型里。
 *
 * ## 标记的约定
 *
 * 每个组件根元素必须带 `data-comp` / `data-slot` / `data-on`，运行时靠这三个
 * 属性切可见性，不需要动 DOM 结构。带动作的再挂 `data-action`，点击它就跑那个
 * 动作——这是"组件自带的交互模组"在 SVG 造型上的落地方式。
 */
import type { MascotComponent, MascotMountPart } from './model';

/**
 * 内联 SVG 造型的把手。
 *
 * 只有两件事可做，因为这套造型没有骨骼也没有弹簧：换表情（`data-state`，CSS
 * 用 `[data-state]` 选形状）、播一次性的动画类（到时自己摘掉）。做成小接口而
 * 不是"什么都能干"，是为了让组件动作不可能偷偷去改别人的属性。
 */
export interface SvgHandle {
  /** 设定表情状态：idle / talk / happy / held / sleep。 */
  state(s: string): void;
  /** 播一次性 CSS 动画类，`ms` 毫秒后移除。 */
  play(cls: string, ms: number): void;
}

/** 每个组件根元素都带的三个属性。 */
const attrs = (comp: string, slot: string) => `data-comp="${comp}" data-slot="${slot}" data-on="1"`;

const one = (mount: MascotMountPart['mount'], html: string): MascotMountPart[] => [{ mount, html }];

/* ── 樱花发卡（小春） ───────────────────────────────────────────────────── */

const sakuraFlower = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288]
    .map(
      (a) =>
        `<path transform="rotate(${a})" d="M0 0 C-4.4 -4 -3.6 -10.4 -1 -11.6 L0 -10 L1 -11.6 C3.6 -10.4 4.4 -4 0 0Z" fill="#ffd0e0" stroke="#ee8aaa" stroke-width=".6"/>`,
    )
    .join('')}<circle r="1.9" fill="#ffd877"/></g>`;

export const SAKURA: MascotComponent<unknown, unknown> = {
  id: 'sakura',
  slot: 'head',
  fits: ['haru'],
  label: { name: '樱花发卡', code: 'HEAD', note: '两朵，别在右侧鬓角' },
  parts: () =>
    one('head', `<g ${attrs('sakura', 'head')}>${sakuraFlower(132, 60, 0.95)}${sakuraFlower(140, 70, 0.6)}</g>`),
};

/* ── 太阳发夹（小晴） ───────────────────────────────────────────────────── */

export const SUNCLIP: MascotComponent<unknown, unknown> = {
  id: 'sunclip',
  slot: 'head',
  fits: ['sora'],
  label: { name: '太阳发夹', code: 'HEAD', note: '左侧刘海，八道光芒' },
  parts: () =>
    one(
      'head',
      `<g ${attrs('sunclip', 'head')}><g transform="translate(72 58)"><g stroke="#f0a92a" stroke-width="1.2" stroke-linecap="round">${[
        0, 45, 90, 135, 180, 225, 270, 315,
      ]
        .map((a) => `<path transform="rotate(${a})" d="M0 -6.4V-8.8"/>`)
        .join('')}</g><circle r="4.6" fill="#ffd45e" stroke="#e59e1f" stroke-width=".8"/><path d="M-1.8 -.6h.01M1.8 -.6h.01" stroke="#9a5a12" stroke-width="1.2" stroke-linecap="round"/><path d="M-1.6 1.4Q0 2.8 1.6 1.4" fill="none" stroke="#9a5a12" stroke-width=".8"/></g></g>`,
    ),
};

/* ── 透明雨伞（小晴） ───────────────────────────────────────────────────── */

/**
 * 伞面单独包一层 `.ms-umb-canopy`，是为了让"转伞"不跟"随风轻摆"抢同一个
 * 元素：`.ms-umb` 上已经挂着 `ms-umb` 摇摆动画，再往同一个元素写 `animation`
 * 会把它顶掉，伞就只在点击时动、平时死着。
 */
export const UMBRELLA: MascotComponent<SvgHandle, unknown> = {
  id: 'umbrella',
  slot: 'back',
  fits: ['sora'],
  label: { name: '透明雨伞', code: 'BACK', note: '磨砂白伞面，点伞面会转一圈' },
  parts: () =>
    one(
      'behind',
      `<g class="ms-umb" ${attrs('umbrella', 'back')} data-action="umbrella:twirl">
      <path d="M54 44C58 130 62 190 68 244" fill="none" stroke="#b9c3d2" stroke-width="2.4" stroke-linecap="round"/>
      <g class="ms-umb-canopy">
        <path d="M4 46Q54 -12 104 46Q91 38 79 46Q66 38 54 46Q41 38 29 46Q16 38 4 46Z" fill="#e8f4ff" fill-opacity=".5" stroke="#fff" stroke-opacity=".9" stroke-width="1.3"/>
        <path d="M54 -6V46M54 -6Q38 12 29 46M54 -6Q70 12 79 46M54 -6Q24 18 4 46M54 -6Q84 18 104 46" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7"/>
        <g fill="#fff" opacity=".85"><circle cx="30" cy="16" r="1.4"/><circle cx="70" cy="10" r="1.2"/><circle cx="86" cy="30" r="1.5"/><circle cx="44" cy="4" r="1"/><circle cx="14" cy="34" r="1.1"/></g>
        <path d="M54 -8V-14" stroke="#b9c3d2" stroke-width="1.8" stroke-linecap="round"/>
      </g>
    </g>`,
    ),
  actions: [
    {
      id: 'umbrella:twirl',
      owner: 'umbrella',
      label: { name: '转伞', code: 'TWIRL' },
      duration: 1200,
      onStart: (h) => h.play('is-twirl', 1200),
    },
  ],
  /* 被抱起来的时候伞会合上——这是这套规则里唯一"看不见但说得通"的一条。 */
  hideIn: ['svg:held'],
};

/* ── 手里的书（Q 版） ───────────────────────────────────────────────────── */

export const BOOK: MascotComponent<SvgHandle, unknown> = {
  id: 'book',
  slot: 'hand',
  fits: ['chibi'],
  label: { name: '手里的书', code: 'HAND', note: '被抱起、睡着时会收起' },
  parts: () =>
    one(
      'body',
      `<g class="ms-book" ${attrs('book', 'hand')}><path class="ms-cover" d="M58 136 l22 6 l22 -6 v18 l-22 6 l-22 -6z"/><path class="ms-pages" d="M80 142 v18"/></g>`,
    ),
  hideIn: ['svg:held', 'svg:sleep'],
};

/** 内联 SVG 造型的全部组件。顺序即后台的列出顺序。 */
export const SVG_COMPONENTS: Record<string, MascotComponent<SvgHandle, unknown>> = {
  sakura: SAKURA as MascotComponent<SvgHandle, unknown>,
  sunclip: SUNCLIP as MascotComponent<SvgHandle, unknown>,
  umbrella: UMBRELLA,
  book: BOOK,
};

export type SvgComponentId = keyof typeof SVG_COMPONENTS;

/**
 * 每个造型默认挂哪些组件。
 *
 * 这就是"换主题 = 换角色 + 它自带的组件"：主题只声明角色，组件随角色走，所以
 * 十二个主题不需要各自维护一份组件清单。后台显式选了组件时这份默认值让位
 * （`undefined` 表示"用默认"，空数组表示"一件都不挂"，两者不同）。
 */
export const SVG_COMPONENT_DEFAULTS: Record<string, readonly string[]> = {
  chibi: ['book'],
  haru: ['sakura'],
  sora: ['umbrella', 'sunclip'],
  lacia: [],
};
