/**
 * 后台用的组件目录：把骨架的组件表投影成界面要的字段。
 *
 * 为什么需要这一层：骨架的组件是 `MascotComponent<RigHandle, LaciaSkin>`，带
 * 泛型把手；设置面板要的只是"叫什么、占哪个槽、带几个动作、能不能挂在这个角
 * 色身上"——与把手无关。在这里投影成 `ComponentInfo`，界面不必知道骨架的类型
 * 细节。
 *
 * 曾经这里是"两套渲染器的组件表摊平成一份"：平涂造型（小春 / 小晴 / Q 版）
 * 有一套自己的 `SVG_COMPONENTS`。那三个造型改成生成立绘 + 骨架之后，站点上只
 * 剩一种渲染器，摊平这一层就没有第二张表可摊了。
 */
import { LACIA_COMPONENTS, SELF_ACTIONS, SKIN_COMPONENT_DEFAULTS } from '../lacia/registry';
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

const TABLE = LACIA_COMPONENTS as Record<string, AnyComponent>;

/** 能挂在这个角色身上的组件，按绘制顺序（身体由外向内）排。 */
export function componentCatalog(character: string): ComponentInfo[] {
  const out: ComponentInfo[] = [];
  for (const id of Object.keys(TABLE)) {
    const c = TABLE[id]!;
    /* `fits` 省略 = 任何角色都能挂。目前每一件都写明了 `fits: ['lacia']`，
       因为装置与锁扣都是照着她量的；三个原创角色暂时没有可拆的配饰。 */
    if (c.fits && !c.fits.includes(character)) continue;
    out.push({ id: c.id, slot: c.slot, name: c.label.name, code: c.label.code, note: c.label.note, actions: c.actions?.length ?? 0 });
  }
  const rank = (c: ComponentInfo) => {
    const i = SLOT_RANK.indexOf(c.slot);
    return i < 0 ? SLOT_RANK.length : i;
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

/**
 * 这套皮肤默认挂什么。
 *
 * 按**皮肤**而不是按角色分：蓝裙什么都不挂，礼服更是一件都没有。参数留了
 * `character` 是为了让调用点读起来还是"这个角色的默认值"——组件表本身已经不
 * 再按角色分叉了。
 */
export function defaultComponentIds(_character: string, skin: string): readonly string[] {
  return SKIN_COMPONENT_DEFAULTS[skin] ?? [];
}

/** 这个角色自带几个动作（不算组件带来的）。四副骨架共用同一张自带表。 */
export function selfActionCount(_character: string): number {
  return SELF_ACTIONS.length;
}
