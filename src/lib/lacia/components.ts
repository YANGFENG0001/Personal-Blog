/**
 * Optional components — what is mounted on her, what it can do, and what is
 * allowed on screen while it does it.
 *
 * ## Why this is not a dense N×N table
 *
 * The obvious model is one row per action, one column per component, one
 * boolean per cell. It is the model a designer draws on a whiteboard, and it
 * is the wrong thing to *author*:
 *
 * 1. **The cells are almost all `true`.** Thirteen slots against a dozen
 *    actions is 150+ booleans; the shipped rules touch two of them. Writing a
 *    table to set two values is a 75× authoring tax that grows quadratically.
 * 2. **It breaks the one-click rule.** "New component must declare its own
 *    visibility" is a per-component statement. In a dense table it becomes
 *    "edit every action row", i.e. N edits per new component, and every
 *    missed cell silently shows the wrong thing.
 * 3. **A boolean cannot hold a schedule.** Actions have a duration; the honest
 *    rule is often "hidden from 0.4 s" or "fades out as the plates swing".
 *    A cell is a snapshot, so it would need to be replaced the first time a
 *    real animation needs it.
 * 4. **It duplicates the truth.** The action already knows what it occludes.
 *    A table is a second copy that will drift.
 *
 * So the authored surface is two sparse statements, one on each side:
 *
 *   action     `visibility: { waist: false }`   — "while I play, hide this slot"
 *   component  `hideIn: ['monolith:unfold']`    — "I get out of the way of this"
 *
 * Both are O(1) per entry and neither grows when the other side gains a
 * member. Precedence is explicit > component > visible, so an action can always
 * override a component's own declaration.
 *
 * The matrix is still available — `visibilityMatrix()` derives it. It is the
 * test oracle and the thing to show in a settings panel, but it is never
 * hand-maintained: it is computed from the two sparse sides above, which is why
 * it cannot disagree with them.
 *
 * ## Why slots and not component ids
 *
 * An action should keep working when a new component is added to the same body
 * region. Addressing `slot: 'aura'` means a future halo and a future cloak both
 * obey a rule written before either existed; addressing `component: 'halo'`
 * would mean every action has to be revisited whenever anything is added. The
 * column count is therefore bounded by the body, not by the content.
 */

import type { LaciaForm } from './lines';
import type { SayLine } from '../viseme';
import type { LaciaSkin } from './rig';

/** Body regions a component can occupy. Actions address these, never ids. */
export const LACIA_SLOTS = [
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

export type LaciaSlot = (typeof LACIA_SLOTS)[number];

export const SLOT_LABELS: Record<LaciaSlot, string> = {
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
 * Where a component's markup is anchored.
 *
 * `stage` is the device layer behind the whole figure; anything else is a bone,
 * so the part inherits that bone's transform — which is the whole point of
 * mounting a prop rather than pasting it on the canvas.
 */
export type LaciaMount = 'stage' | 'hips' | 'chest' | 'head' | 'wristR' | 'wristL';

/**
 * Springs an action module may address.
 *
 * Declared here rather than inferred from the rig so that a component can name
 * a gesture without importing the engine. `LaciaRig` annotates its spring table
 * with `Record<LaciaSpring, Spring>`, so adding a spring without adding it here
 * (or the reverse) is a compile error rather than a runtime no-op.
 */
export type LaciaSpring =
  | 'rootY'
  | 'hipsX'
  | 'hipsR'
  | 'spineR'
  | 'chestR'
  | 'torsoR'
  | 'torsoShift'
  | 'torsoY'
  | 'torsoX'
  | 'neckR'
  | 'neckX'
  | 'neckY'
  | 'headR'
  | 'headX'
  | 'headY'
  | 'headTurn'
  | 'hairFWorld'
  | 'hairBWorld'
  | 'armRR'
  | 'armLR'
  | 'legRR'
  | 'legLR'
  | 'kneeRR'
  | 'kneeLR'
  | 'elbowRR'
  | 'elbowLR'
  | 'wristRR'
  | 'wristLR'
  | 'ankleRR'
  | 'ankleLR'
  | 'monY'
  | 'monR'
  | 'monHit'
  | 'monWorld'
  | 'monAim'
  | 'monRecoil'
  | 'browY'
  | 'browTilt'
  | 'mouthOpen'
  | 'mouthWide';

/**
 * What an action module is allowed to do to the figure.
 *
 * Deliberately a small surface: components describe gestures, they do not get
 * a handle on the rig. `after` is owned by the rig so an interrupted action
 * cannot leave a delayed callback behind — which is the bug you get with a bare
 * `setTimeout` the moment two actions overlap.
 */
export interface RigHandle {
  impulse(spring: LaciaSpring, peak: number): void;
  kick(spring: LaciaSpring, velocity: number): void;
  /** Apply a device configuration without running its action (used by actions). */
  setDeviceForm(form: LaciaForm): void;
  say(lines: readonly SayLine[]): void;
  after(ms: number, fn: () => void): void;
}

export interface LaciaAction {
  id: string;
  /** Component id, or `self` for the character's own modules. */
  owner: string;
  label: { name: string; code: string };
  /**
   * Sparse visibility row. A slot that is not mentioned stays visible, which is
   * what makes the character's own modules "show everything" without a rule.
   */
  visibility?: Partial<Record<LaciaSlot, boolean>>;
  /** ms. 0 or omitted = holds until replaced by another action. */
  duration?: number;
  onStart?: (h: RigHandle) => void;
  onEnd?: (h: RigHandle) => void;
}

export interface LaciaMountPart {
  mount: LaciaMount;
  /** Complete element markup, carrying `data-comp` / `data-slot` / `data-on`. */
  html: string;
}

export interface ComponentContext {
  /** Namespace for gradient ids — one rig per mounting variant. */
  uid: string;
  /** The resolved outfit, for parts whose position depends on what she wears. */
  skin: LaciaSkin;
}

export interface LaciaComponent {
  id: string;
  slot: LaciaSlot;
  label: { name: string; code: string; note?: string };
  parts: (ctx: ComponentContext) => readonly LaciaMountPart[];
  actions?: readonly LaciaAction[];
  /**
   * Actions (by id, or by owner id as a tag) during which this component gets
   * out of the way on its own initiative.
   *
   * This is the half of the rule that lives on the component, and it is what
   * makes adding a component a one-file change: a new piece declares what it
   * cannot coexist with, and no existing action is touched.
   */
  hideIn?: readonly string[];
}

/**
 * Is `component` on screen while `action` plays?
 *
 * Three levels, first match wins:
 *   1. the action says so explicitly   (`visibility[slot]`)
 *   2. the component opts out          (`hideIn` matches the action or its owner)
 *   3. visible
 */
export function actionVisible(action: LaciaAction, component: LaciaComponent): boolean {
  const explicit = action.visibility?.[component.slot];
  if (explicit !== undefined) return explicit;
  const hide = component.hideIn;
  if (hide && (hide.includes(action.id) || hide.includes(action.owner))) return false;
  return true;
}

/** Every action the enabled components bring, character modules included. */
export function actionList(components: readonly LaciaComponent[]): LaciaAction[] {
  return components.flatMap((c) => c.actions ?? []);
}

export function findAction(components: readonly LaciaComponent[], id: string): LaciaAction | undefined {
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
  /** Which side decided it — for the settings panel and for test messages. */
  by: 'action' | 'component' | 'default';
}

export interface VisibilityMatrix {
  slots: readonly LaciaSlot[];
  components: readonly { id: string; slot: LaciaSlot; name: string }[];
  actions: readonly { id: string; owner: string; name: string }[];
  /** `cells[actionIndex][componentIndex]`. */
  cells: readonly (readonly boolean[])[];
  /** Only the cells that differ from "visible" — the entire authored surface. */
  overrides: readonly VisibilityCell[];
}

/**
 * Derive the action × component table.
 *
 * This exists to be *read*, never written: it is what a settings panel shows
 * and what the verifier asserts against. Deriving it means it is always equal
 * to the sparse rules by construction.
 */
export function visibilityMatrix(components: readonly LaciaComponent[]): VisibilityMatrix {
  const actions = actionList(components);
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
    slots: LACIA_SLOTS,
    components: components.map((c) => ({ id: c.id, slot: c.slot, name: c.label.name })),
    actions: actions.map((a) => ({ id: a.id, owner: a.owner, name: a.label.name })),
    cells,
    overrides,
  };
}
