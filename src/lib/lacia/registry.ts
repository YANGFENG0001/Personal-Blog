/**
 * 骨架真正出厂的组件。
 *
 * 组件是**可能装、也可能不装**的硬件：骨架只在它启用时渲染它，它的动作也只
 * 在那时进入动作表。这就是"蓝裙没有武器"能写成一行事实而不是一个特例的原因
 * ——那条裙子什么都不启用。
 *
 * 加一个组件就是在这里加一个对象。不需要动任何已有动作：新东西若不能与什么
 * 共存，它自己在 `hideIn` 里说。
 */
import { LACIA_FORM_LABELS, LACIA_FORM_ORDER, type LaciaForm } from './lines';
import { monolithSvg } from './monolith';
import type { RigHandle } from './handle';
import type { ComponentContext, MascotAction, MascotComponent, MascotSlot } from '../mascot/model';
import { resolveComponents as resolve } from '../mascot/model';
import type { LaciaSkin } from './rig';

/** 每个部件根元素都带的属性，骨架靠它切可见性而不动 DOM 结构。 */
const attrs = (comp: string, slot: MascotSlot) => `data-comp="${comp}" data-slot="${slot}" data-on="1"`;

type Comp = MascotComponent<RigHandle, LaciaSkin>;

/* ── lock ──────────────────────────────────────────────────────────────────
 *
 * 腰间四片翼状板。它是**组件**而不是装置标记的一部分，有两个理由：它长在她
 * 身上而装置悬在她身后，所以必须挂到髋骨上继承那段变换；并且它是唯一一件位置
 * 取决于穿什么的部件（见 `LaciaSkin.lock`）。
 */
function lockSvg(pos: readonly [number, number] | undefined, slot: MascotSlot): string {
  const style = pos ? `left:${pos[0]}px;top:${pos[1]}px` : '';
  return `<svg class="lr-device-lock" viewBox="0 0 200 90" aria-hidden="true" ${attrs('lock', slot)}${style ? ` style="${style}"` : ''}>
            <g class="lr-dl-plate"><path d="M100 45 L58 31 L40 42 L60 54 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L58 59 L40 48 L60 36 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L142 31 L160 42 L140 54 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L142 59 L160 48 L140 36 Z"/></g>
            <circle class="lr-dl-core" cx="100" cy="45" r="4.5"/>
          </svg>`;
}

const LOCK: Comp = {
  id: 'lock',
  slot: 'waist',
  /* 骨架的组件只可能挂在蕾西亚身上：她用的是骨架，别的角色是平涂造型。不写
     这一行，后台就会给小春列出"DEVICE LOCK"。 */
  fits: ['lacia'],
  label: { name: 'DEVICE LOCK', code: 'WAIST', note: '腰间四片翼状板，需物主同意' },
  parts: ({ subject }: ComponentContext<LaciaSkin>) => [{ mount: 'hips', html: lockSvg(subject.lock, 'waist') }],
};

/* ── BLACK MONOLITH ────────────────────────────────────────────────────────
 *
 * 四种构型，四个动作。构型是持续状态（直到选另一个），动作是**去往**那里的
 * 过程——所以它有长有时长，身体反应也写在里面。
 */
const FORM_REACTION: Record<LaciaForm, (h: RigHandle) => void> = {
  /* 合上没有冲量：板子在自己的驱动下收回去。 */
  coffin: () => {},

  /* 导轨抛出，她吸收后坐力——髋向后、胸向后、两臂被推、头在弹丸离膛后慢半拍
     甩一下。 */
  railgun: (h) => {
    h.kick('monRecoil', 420);
    h.kick('hipsX', -11);
    h.kick('chestR', -3.4);
    h.kick('armRR', 5);
    h.kick('armLR', -7);
    /* 她把重心压下去吃这一下。没有这一句，上半身在支撑而腿还站着不动，腰以上
       看着像贴上去的。 */
    h.impulse('kneeRR', 3.4);
    h.impulse('kneeLR', 2.6);
    h.impulse('monHit', -3.2);
    h.after(260, () => h.kick('headR', -13));
  },

  /* 什么都没抛出去，所以没有后坐——只是稳定下来。 */
  shield: () => {},

  /* 八片同时锁出去，四种里最重的一下，所以摆幅最大。 */
  unfold: (h) => {
    h.impulse('monHit', -4.4);
    h.kick('headR', -5);
    h.kick('armRR', 4);
    h.kick('armLR', -4);
  },
};

/** 每种构型稳定下来要多久，ms。最长的弹簧（monHit 1.1 Hz）要约 1.6 秒才看不
 *  出还在动。 */
const FORM_DURATION: Record<LaciaForm, number> = { coffin: 900, railgun: 1600, shield: 1200, unfold: 1600 };

function formAction(form: LaciaForm): MascotAction<RigHandle> {
  return {
    id: `monolith:${form}`,
    owner: 'monolith',
    label: { name: LACIA_FORM_LABELS[form].name, code: LACIA_FORM_LABELS[form].code },
    duration: FORM_DURATION[form],
    /* 展开会把八片从轮毂里锁出去，而锁扣那四片正是这个基座上的固定卡榫——它们
       在摆开时脱开、稳定后重新咬合。这是出厂规则里唯一一条跨组件的规则，而且是
       瞬时的：动作结束时会恢复所有槽位，所以卡榫自己会回来。 */
    visibility: form === 'unfold' ? { waist: false } : undefined,
    onStart: (h) => {
      h.setDeviceForm(form);
      FORM_REACTION[form](h);
    },
  };
}

const MONOLITH: Comp = {
  id: 'monolith',
  slot: 'device',
  fits: ['lacia'],
  label: { name: 'BLACK MONOLITH', code: 'DEVICE', note: '黑色秘棺 · 四种构型' },
  parts: ({ uid }: ComponentContext<LaciaSkin>) => [{ mount: 'stage', html: monolithSvg(uid, attrs('monolith', 'device')) }],
  actions: LACIA_FORM_ORDER.map(formAction),
};

/* ── 角色自带的模组 ─────────────────────────────────────────────────────────
 *
 * owner 是 `self`，且不是组件：她永远在，所以设置面板从不提供"卸下她"。没有
 * 可见性行，这正是"她自带的模组全都显示"——设计要的默认值。 */
export const SELF_ACTIONS: readonly MascotAction<RigHandle>[] = [
  {
    id: 'self:poke',
    owner: 'self',
    label: { name: '受击', code: 'POKE' },
    duration: 900,
    onStart: (h) => {
      h.kick('headR', -11);
      h.kick('headY', 4);
      /* 只动头是"棍子上的摇头娃娃"的根源。重心落到一边膝盖，髋吃一下，两腿
         不等量地接住——她自己稳住了。 */
      h.impulse('kneeRR', 2.8);
      h.impulse('kneeLR', -1.5);
      h.kick('hipsX', 1.6);
      /* 装置插在她身上，所以过身体的冲击也会到它那儿。2.6° 在枪口是约 50 单位，
         是角落尺寸下还能看出来的最小摆幅。没有装置的衣服上这根弹簧空转。 */
      h.impulse('monHit', -2.6);
    },
  },
];

/** 能装的都在这里。顺序即设置面板的列出顺序。 */
export const LACIA_COMPONENTS: Record<string, Comp> = {
  monolith: MONOLITH,
  lock: LOCK,
};

export type LaciaComponentId = keyof typeof LACIA_COMPONENTS;

export const COMPONENT_IDS = Object.keys(LACIA_COMPONENTS) as LaciaComponentId[];

/**
 * 每套衣服默认挂什么。
 *
 * 放在这里而不是写在皮肤上，是为了让后台不拉引擎也能读到：设置面板要显示
 * "这套衣服会挂哪些"，而为这个 import `rig.ts` 会把弹簧、IK、标记生成器一起
 * 拖进包体。
 */
export const SKIN_COMPONENT_DEFAULTS: Record<string, readonly string[]> = {
  suit: ['monolith', 'lock'],
  dress: [],
};

/** id 列表 → 组件数组，按槽位排序，丢掉不认识的 id。 */
export function resolveComponents(ids: readonly string[]): Comp[] {
  return resolve(LACIA_COMPONENTS, ids);
}
