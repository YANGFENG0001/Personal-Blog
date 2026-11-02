/**
 * 蕾西亚的台词与装置读数。
 *
 * 两类内容严格分开：
 *
 * - `LACIA_QUOTES` 是作品台词，带 `src` 说明出处与置信度。**日文并非逐字原文**，
 *   而是据英译/中译回译——中文资料里全是译文，日文原句无从核对，所以宁可标注
 *   清楚也不编造。要补真句，直接往这个数组里加，刷新即生效。
 * - `LACIA_LINES` 是为站点语境写的原创台词，按 LINE_GROUPS 分组；`LACIA_FORMS`
 *   是切换装置形态时显示的读数（系统信息，不是角色台词）。
 *
 * 文件独立于 rig 引擎：改台词不需要碰任何渲染代码。
 */
import type { LineGroup } from '../mascot-pack';

export interface LaciaQuote {
  /** 日文（或作品原文语言）。 */
  jp: string;
  /** 中文对照。 */
  cn: string;
  /** 出处与置信度，只出现在说明面板里，不上屏。 */
  src: string;
}

export const LACIA_QUOTES: readonly LaciaQuote[] = [
  {
    jp: '物の価値は、人間が与えた形と機能によって決まる。',
    cn: '物品的价值，由人类赋予它的形态与功能决定。',
    src: '核心台词。英译 "The value of an object is determined by the form and function that humans give to it."（BEATLESS 角色词条引语）。日文为据英译回译。',
  },
  {
    jp: '私は魂を持っていない。',
    cn: '我没有灵魂。',
    src: '原作中她对新人的自述（「I have no soul」）。日文为据英译回译。',
  },
  {
    jp: '私は、道具です。',
    cn: '我是道具。',
    src: '概括性表述——「道具」是她对自身的核心定义，并非某一集的逐字台词。',
  },
];

export type LaciaForm = 'coffin' | 'railgun' | 'shield' | 'unfold';

export const LACIA_FORM_ORDER: readonly LaciaForm[] = ['coffin', 'railgun', 'shield', 'unfold'];

/** 形态的中文名与代号，控制台按钮直接用。 */
export const LACIA_FORM_LABELS: Record<LaciaForm, { name: string; code: string; lineGroup: LineGroup }> = {
  coffin: { name: '收束', code: 'CASKET', lineGroup: 'formCoffin' },
  railgun: { name: '轨道炮', code: 'RAILGUN', lineGroup: 'formRailgun' },
  shield: { name: '障壁', code: 'BARRIER', lineGroup: 'formShield' },
  unfold: { name: '展开', code: 'DEPLOY', lineGroup: 'formUnfold' },
};

/** 形态切换时打出的系统读数：[标题, 说明]。 */
export const LACIA_FORMS: Record<LaciaForm, readonly [string, string]> = {
  coffin: ['BLACK MONOLITH — 収束', '棺体闭合 · 量子计算核心待机'],
  railgun: ['質量投射 — 軌道砲', '电磁场约束建立 · 超材料弹道展开'],
  shield: ['障壁展開', '晶体板六面展开 · 力场生成'],
  unfold: ['八爪分離 · 光学迷彩', '超材料折射率调制 · 目标护卫待命'],
};

/**
 * 站内台词，按 LINE_GROUPS 分组。缺的分组会回落到 click（见 pickLines）。
 * 这些是为博客语境写的原创句子，不是作品台词。
 */
export const LACIA_LINES: Partial<Record<LineGroup, string[]>> = {
  click: [
    '你回来了。……契约仍然有效。',
    '我不是人类。但我在听。',
    '如果我说我有心，你会害怕吗？',
    '今天还剩多少工作？我可以等。',
    '不必对我客气。我是你的道具。',
    '你的笑容，我记住了。',
    '没有心跳，也能听见你。',
    '把重要的东西交给我吧。我会守好。',
  ],
  morning: ['早。今天的你，比昨天醒得更早一点。', '晨光的角度变了。我记录一下。'],
  noon: ['中午了。人类的胃比演算更需要照顾。', '要不要先停一下？我可以等。'],
  evening: ['天开始暗了。灯，我帮你留着。', '傍晚的光，比任何时候都像你。'],
  night: ['这个点了。我不用睡，但我可以安静。', '夜深了。别让我等太久。'],
  home: ['这里是你的起点。我记得。', '回来了就好。'],
  article: ['这一篇，你读得比上一篇慢。', '需要我念给你听吗？'],
  notFound: ['这个地址不存在。……要回去吗？', '页面没有找到。但我还在。'],
  readEnd: ['读完了。要不要写点什么？', '结束的地方，通常也是开始。'],
  drag: ['……要带我去哪里？', '请轻一点。这不是请求。'],
  drop: ['这里也可以。', '放好了。我在这里等你。'],
  reset: ['回到原位了。', '原来你还是喜欢我待在这里。'],
  formCoffin: ['棺体闭合。演算核心待机中。', '收束完成。这样比较安静。'],
  formRailgun: ['「質量投射」。要开火吗——请下命令。', '轨道炮就绪。这次不是威胁。'],
  formShield: ['障壁展开。站到我后面。', '六面展开。……别乱动。'],
  formUnfold: ['八爪分离。其中一支，跟着你。', '光学迷彩启动。看不见我，不代表我不在。'],
};
