/**
 * 后台用的组件目录：把两套渲染器的组件表摊平成一份，只留界面要的字段。
 *
 * 为什么需要这一层：骨架的组件是 `MascotComponent<RigHandle, LaciaSkin>`，造型
 * 的是 `MascotComponent<SvgHandle, unknown>`，两种把手不能合并成一个类型。但
 * 设置面板要的只是"叫什么、占哪个槽、带几个动作、能不能挂在这个角色身上"——
 * 与把手无关。所以在这里投影成 `ComponentInfo`，界面对两种渲染器一视同仁，
 * 而两边各自的类型安全一点没丢。
 */
import { LACIA_COMPONENTS, SKIN_COMPONENT_DEFAULTS } from '../lacia/registry';
import { SVG_COMPONENTS, SVG_COMPONENT_DEFAULTS } from './parts';
import { SVG_SELF_ACTIONS } from './actions';
import { SLOT_RANK, type MascotSlot } from './model';

export interface ComponentInfo {
  id: string;
  slot: MascotSlot;
  name: string;
  code: string;
  note?: string;
  /** 这个组件自带几个动作模组。0 = 纯装饰。 */
  actions: number;
}

type AnyComponent = {
  id: string;
  slot: MascotSlot;
  label: { name: string; code: string; note?: string };
  actions?: readonly unknown[];
  fits?: readonly string[];
};

const TABLES: readonly Record<string, AnyComponent>[] = [LACIA_COMPONENTS as Record<string, AnyComponent>, SVG_COMPONENTS as Record<string, AnyComponent>];

/** 能挂在这个角色身上的组件，按绘制顺序（身体由外向内）排。 */
export function componentCatalog(character: string): ComponentInfo[] {
  const out: ComponentInfo[] = [];
  for (const table of TABLES) {
    for (const id of Object.keys(table)) {
      const c = table[id]!;
      /* `fits` 省略 = 任何角色都能挂。骨架的组件没有 fits，因为它们本来就只服务
         于蕾西亚——她用的是骨架。 */
      if (c.fits && !c.fits.includes(character)) continue;
      out.push({ id: c.id, slot: c.slot, name: c.label.name, code: c.label.code, note: c.label.note, actions: c.actions?.length ?? 0 });
    }
  }
  const rank = (c: ComponentInfo) => {
    const i = SLOT_RANK.indexOf(c.slot);
    return i < 0 ? SLOT_RANK.length : i;
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

/**
 * 这个角色默认挂什么。
 *
 * 骨架按**服装**分（蓝裙什么都不挂），造型按**角色**分（小晴带伞和发夹）。两种
 * 都归到这一个函数，后台就不用自己判断渲染器。
 */
export function defaultComponentIds(character: string, skin: string): readonly string[] {
  if (character === 'lacia') return SKIN_COMPONENT_DEFAULTS[skin] ?? [];
  return SVG_COMPONENT_DEFAULTS[character] ?? [];
}

/** 这个角色自带几个动作（不算组件带来的）。 */
export function selfActionCount(character: string): number {
  return character === 'lacia' ? 1 : SVG_SELF_ACTIONS.length;
}
