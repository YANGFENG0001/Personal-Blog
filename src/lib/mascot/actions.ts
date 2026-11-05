/**
 * 内联 SVG 造型自带的动作模组。
 *
 * 五个状态各是一个动作，因为它们本来就是同一件事的两种叫法：造型没有骨骼，
 * 一个"动作"能做的只有换表情（`data-state` 让 CSS 选形状）和播一次性的动画
 * 类。把它们写成动作而不是散在脚本里，换来的是**同一套可见性规则**——组件可以
 * 声明"这个动作我让开"，而这正是书和伞在被抱起时收起来的实现方式。
 *
 * 命名空间是 `svg:`，与骨架的 `monolith:` / `self:poke` 并列，互不覆盖：同一个
 * 站点可能同时存在两种渲染器（角落是骨架、设置面板里是造型预览）。
 */
import { actionList, resolveComponents, type MascotAction, type MascotComponent } from './model';
import { SVG_COMPONENTS, type SvgHandle } from './parts';

/**
 * 角色自带。owner 一律是 `self`。
 *
 * `duration` 只写在会自己结束的那几个上：说话和开心是一句话的长度，说完回到
 * 待机；被抱起与睡着是**持续状态**，只能被下一个动作替换——写个 3 秒的时长
 * 会让被拎在空中的她在三秒后突然笑起来。
 */
export const SVG_SELF_ACTIONS: readonly MascotAction<SvgHandle>[] = [
  {
    id: 'svg:idle',
    owner: 'self',
    label: { name: '待机', code: 'IDLE' },
    onStart: (h) => h.state('idle'),
  },
  {
    id: 'svg:talk',
    owner: 'self',
    label: { name: '说话', code: 'TALK' },
    duration: 3400,
    onStart: (h) => h.state('talk'),
  },
  {
    id: 'svg:happy',
    owner: 'self',
    label: { name: '开心', code: 'HAPPY' },
    duration: 3400,
    onStart: (h) => h.state('happy'),
  },
  {
    id: 'svg:held',
    owner: 'self',
    label: { name: '被抱起', code: 'HELD' },
    onStart: (h) => h.state('held'),
  },
  {
    id: 'svg:sleep',
    owner: 'self',
    label: { name: '睡着', code: 'SLEEP' },
    onStart: (h) => h.state('sleep'),
  },
  {
    id: 'self:poke',
    owner: 'self',
    label: { name: '受击', code: 'POKE' },
    duration: 700,
    /* 造型没有弹簧，所以"受击"就是一次快速摆头。类名挂在根元素上，CSS 负责
       把它变成关键帧；到时由 `play()` 自己摘掉，不需要动作收尾。 */
    onStart: (h) => h.play('is-poked', 700),
  },
];

/** 表情状态名 → 动作 id。状态机只认状态，动作表只认 id，这一行是唯一的桥。 */
export function actionForState(state: string): string {
  return `svg:${state}`;
}

/**
 * 这个角色挂上这些组件之后，装了什么、能做什么。
 *
 * 组件 id 从 DOM 读（渲染时写在 `data-comp` 上），所以客户端不需要知道"当前
 * 是哪套配置"——它读的是画面上真实存在的东西，不可能与标记脱节。
 *
 * 组件和动作一起返回，是因为可见性解析两边都要：光有动作表算不出"这一格该不该
 * 藏"，还得有组件的槽位与 `hideIn`。
 */
export function svgMounted(componentIds: readonly string[]): {
  components: readonly MascotComponent<SvgHandle, unknown>[];
  actions: readonly MascotAction<SvgHandle>[];
} {
  const components = resolveComponents(SVG_COMPONENTS, componentIds);
  return { components, actions: [...SVG_SELF_ACTIONS, ...actionList(components)] };
}

/** 只要动作表的场合。 */
export function svgActionsFor(componentIds: readonly string[]): readonly MascotAction<SvgHandle>[] {
  return svgMounted(componentIds).actions;
}
