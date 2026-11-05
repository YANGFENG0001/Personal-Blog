/**
 * 看板娘的通用模型：槽位、挂载点、动作、组件、可见性。
 *
 * 这套东西**不认识任何具体渲染器**。骨架（`lib/lacia`）和内联 SVG 造型
 * （`lib/mascot/svg.ts`）各自实现自己的渲染，但组件表、动作表、槽位寻址和
 * 可见性解析是同一份代码——否则两套看板娘会慢慢长成两种行为，"可选组件"在
 * 一边生效在另一边失效。
 *
 * ## 为什么不是一张稠密的 N×N 可见性表
 *
 * 最直觉的模型是：一行一个动作、一列一个组件、一格一个布尔。这是白板上画得
 * 出来的模型，也是**写起来**错的模型：
 *
 * 1. **格子几乎全是 `true`。** 13 个槽位 × 十几个动作是 150+ 个布尔，真正
 *    写下来的规则只碰到其中几格。为设两个值写一张表，是 75 倍的书写税，而且
 *    随动作数平方增长。
 * 2. **它破坏"一键加入"。** "新组件自己声明可见性"是对组件说的；在稠密表里
 *    它就变成"改每一行动作"，即每个新组件 N 次编辑，漏一格就静默显示错。
 * 3. **布尔装不下时序。** 动作有时长，诚实的规则常常是"0.4 秒后才藏起来"或
 *    "板子摆开时淡出"。格子是快照，第一次遇到真实动画就得推翻。
 * 4. **它复制真相。** 动作本来就知道自己遮住什么，表是第二份副本，必然漂移。
 *
 * 所以书写面是两半稀疏声明，一边一份：
 *
 *   动作      `visibility: { waist: false }`   — "我播的时候把这个槽位藏起来"
 *   组件      `hideIn: ['monolith:unfold']`    — "这个动作我让开"
 *
 * 两边都是每条 O(1)，且对方增加成员时自己不用改。优先级：动作显式 > 组件自
 * 声明 > 可见，所以动作永远能推翻组件的自我声明。
 *
 * 矩阵仍然存在——`visibilityMatrix()` 把它算出来。它是测试的判据、设置面板要
 * 显示的东西，但从不手写：它由上面两半推导，所以不可能与规则不一致。
 *
 * ## 为什么按槽位寻址而不是按组件 id
 *
 * 动作应当在同一个身体区域新增组件后继续有效。写 `slot: 'aura'` 意味着将来
 * 的光环和斗篷都遵守一条它们出生前就写好的规则；写 `component: 'halo'` 则意味
 * 着每加一件东西都要回头改所有动作。列数由**身体**决定，不由内容决定。
 * 这与 Unity 的 `AvatarMask` 按身体部位遮罩是同一个思路。
 */

/** 组件可以占据的身体区域。动作只寻址这些，从不寻址 id。 */
export const MASCOT_SLOTS = [
  'head',
  'face',
  'neck',
  'torso',
  'back',
  'waist',
  'arm',
  'hand',
  'leg',
  'foot',
  'weapon',
  'aura',
  'device',
] as const;

export type MascotSlot = (typeof MASCOT_SLOTS)[number];

export const SLOT_LABELS: Record<MascotSlot, string> = {
  head: '头部',
  face: '面部',
  neck: '颈部',
  torso: '胸部',
  back: '背部',
  waist: '腰部',
  arm: '手臂',
  hand: '手持',
  leg: '腿部',
  foot: '足部',
  weapon: '武器',
  aura: '周身特效',
  device: '装置',
};

/**
 * 组件标记挂在哪里。
 *
 * 前六个是骨架的骨骼：挂在骨骼上就继承那段骨骼的变换，这才是"装上去"而不是
 * "贴上去"。后两个是内联 SVG 造型用的：`behind` 是人物身后（伞、装置），
 * `body` 是躯干层（手上的书）。两套渲染器各自解释自己认识的挂载点，不认识的
 * 直接丢弃，所以一份组件表可以同时喂给两边而不会互相报错。
 */
export type MascotMount = 'stage' | 'hips' | 'chest' | 'head' | 'wristR' | 'wristL' | 'behind' | 'body';

/**
 * 动作模组能对人物做什么。
 *
 * `H` 是渲染器给的把手：骨架给弹簧（`impulse` / `kick`），内联 SVG 给状态与
 * 一次性动画类（`state` / `play`）。做成泛型而不是"全可选的大接口"，是为了
 * 让写错的把手在编译期就报错，而不是运行时静默什么都不做。
 */
export interface MascotAction<H = unknown> {
  id: string;
  /** 组件 id，或 `self` 表示角色自带的模组。 */
  owner: string;
  label: { name: string; code: string };
  /**
   * 稀疏可见性行。没提到的槽位保持可见——这正是"角色自带模组默认全都显示"
   * 不需要任何规则的原因。
   */
  visibility?: Partial<Record<MascotSlot, boolean>>;
  /** ms。0 或省略 = 一直保持，直到被别的动作替换。 */
  duration?: number;
  onStart?: (h: H) => void;
  onEnd?: (h: H) => void;
}

export interface MascotMountPart {
  mount: MascotMount;
  /** 完整元素标记，自带 `data-comp` / `data-slot` / `data-on`。 */
  html: string;
}

/** 组件拿到的上下文。`subject` 是渲染器自己的主体（骨架皮肤 / SVG 造型配色）。 */
export interface ComponentContext<S = unknown> {
  /** 渐变 id 的命名空间——同一页可能挂多个实例。 */
  uid: string;
  subject: S;
}

export interface MascotComponent<H = unknown, S = unknown> {
  id: string;
  slot: MascotSlot;
  label: { name: string; code: string; note?: string };
  parts: (ctx: ComponentContext<S>) => readonly MascotMountPart[];
  actions?: readonly MascotAction<H>[];
  /**
   * 组件自己让开的动作（写动作 id，或组件 owner id 当标签）。
   *
   * 这是规则里属于组件的那一半，也是"加一个组件只改一个文件"的原因：新东西
   * 自己声明跟谁不能共存，已有动作一行都不用动。
   *
   * 注意：`self` 是所有角色自带模组的 owner，写 `hideIn: ['self']` 会在**全部**
   * 自带动作里消失，几乎一定不是你想要的——写具体动作 id。
   */
  hideIn?: readonly string[];
  /**
   * 这件东西只属于哪个角色（角色 id）。省略 = 任何角色都能挂。
   *
   * 组件表是两套渲染器共用的，所以后台列组件时必须按角色过滤：给"小晴"列出
   * 樱花发卡是纯噪音。
   */
  fits?: readonly string[];
}

/**
 * `action` 播放时 `component` 在不在画面上。
 *
 * 三级，先命中先用：
 *   1. 动作显式说了              （`visibility[slot]`）
 *   2. 组件自己让开              （`hideIn` 命中动作 id 或 owner）
 *   3. 可见
 */
export function actionVisible<H, S>(action: MascotAction<H>, component: MascotComponent<H, S>): boolean {
  const explicit = action.visibility?.[component.slot];
  if (explicit !== undefined) return explicit;
  const hide = component.hideIn;
  if (hide && (hide.includes(action.id) || hide.includes(action.owner))) return false;
  return true;
}

/** 已启用组件带来的全部动作（不含角色自带的那些）。 */
export function actionList<H, S>(components: readonly MascotComponent<H, S>[]): MascotAction<H>[] {
  return components.flatMap((c) => c.actions ?? []);
}

export function findAction<H, S>(components: readonly MascotComponent<H, S>[], id: string): MascotAction<H> | undefined {
  for (const c of components) {
    const hit = c.actions?.find((a) => a.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export interface VisibilityCell {
  action: string;
  component: string;
  visible: boolean;
  /** 谁决定的——给设置面板和测试信息用。 */
  by: 'action' | 'component' | 'default';
}

export interface VisibilityMatrix {
  slots: readonly MascotSlot[];
  components: readonly { id: string; slot: MascotSlot; name: string }[];
  actions: readonly { id: string; owner: string; name: string }[];
  /** `cells[actionIndex][componentIndex]`。 */
  cells: readonly (readonly boolean[])[];
  /** 只有与"可见"不同的格子——这就是全部的书写面。 */
  overrides: readonly VisibilityCell[];
}

/**
 * 推导 action × component 表。
 *
 * 它只被**读**，从不被写：设置面板显示它，验证脚本断言它。推导意味着它按
 * 构造等于那两半稀疏规则。
 */
export function visibilityMatrix<H, S>(
  components: readonly MascotComponent<H, S>[],
  /* 传角色自带的动作表时，矩阵就把它们也列进来——设置面板要显示的就是"全部
     动作 × 全部组件"，而 `actionList` 只认得组件带来的那些。 */
  allActions?: readonly MascotAction<H>[],
): VisibilityMatrix {
  const actions = allActions ?? actionList(components);
  const overrides: VisibilityCell[] = [];
  const cells = actions.map((a) =>
    components.map((c) => {
      const visible = actionVisible(a, c);
      if (!visible) {
        const by: VisibilityCell['by'] = a.visibility?.[c.slot] !== undefined ? 'action' : 'component';
        overrides.push({ action: a.id, component: c.id, visible, by });
      } else if (a.visibility?.[c.slot] === true) {
        overrides.push({ action: a.id, component: c.id, visible, by: 'action' });
      }
      return visible;
    }),
  );
  return {
    slots: MASCOT_SLOTS,
    components: components.map((c) => ({ id: c.id, slot: c.slot, name: c.label.name })),
    actions: actions.map((a) => ({ id: a.id, owner: a.owner, name: a.label.name })),
    cells,
    overrides,
  };
}

/** 绘制顺序：由身体向外。装置层最先，武器最后。 */
export const SLOT_RANK: readonly MascotSlot[] = [
  'device',
  'back',
  'aura',
  'waist',
  'torso',
  'neck',
  'arm',
  'hand',
  'head',
  'face',
  'leg',
  'foot',
  'weapon',
];

/**
 * id 列表 → 组件数组，按槽位排序，丢掉不认识的 id。
 *
 * 按槽位而不是调用方给的顺序，是为了让服务端渲染的标记和 hydrate 之后的标记
 * 不可能在绘制顺序上分歧。
 */
export function resolveComponents<H, S>(
  table: Record<string, MascotComponent<H, S>>,
  ids: readonly string[],
): MascotComponent<H, S>[] {
  const want = new Set(ids);
  const rank = (c: MascotComponent<H, S>) => {
    const i = SLOT_RANK.indexOf(c.slot);
    return i < 0 ? SLOT_RANK.length : i;
  };
  return Object.keys(table)
    .filter((id) => want.has(id))
    .map((id) => table[id]!)
    .sort((a, b) => rank(a) - rank(b));
}

/**
 * 一个角色的完整动作表：自带模组在前，组件带来的在后。
 *
 * 顺序有意义：控制台与设置面板按这个顺序列，自带模组永远排在最前面，所以
 * 拆掉组件不会让"受击"跑到列表末尾。
 */
export function characterActions<H, S>(
  self: readonly MascotAction<H>[],
  components: readonly MascotComponent<H, S>[],
): MascotAction<H>[] {
  return [...self, ...actionList(components)];
}

/** 按角色过滤组件表——后台列组件时用。 */
export function componentsFor<H, S>(
  table: Record<string, MascotComponent<H, S>>,
  character: string,
): MascotComponent<H, S>[] {
  return Object.keys(table)
    .map((id) => table[id]!)
    .filter((c) => !c.fits || c.fits.includes(character));
}

/** 这个角色默认挂哪些组件。省略 = 一件都不挂。 */
export type ComponentDefaults = Record<string, readonly string[]>;

export function defaultComponents(
  defaults: ComponentDefaults,
  character: string,
  override?: readonly string[],
): readonly string[] {
  return override ?? defaults[character] ?? [];
}
