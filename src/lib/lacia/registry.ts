/**
 * The components that actually ship.
 *
 * A component is hardware that may or may not be mounted: the rig renders it
 * only when it is enabled, and its actions join the action list only then. That
 * is what makes "the blue dress has no weapon" a one-line fact instead of a
 * special case — the dress simply enables nothing.
 *
 * Adding a component is one object here. It does not require touching any
 * action that already exists: if the new piece cannot coexist with something,
 * it says so in its own `hideIn`.
 */
import { LACIA_FORM_LABELS, LACIA_FORM_ORDER, type LaciaForm } from './lines';
import { monolithSvg } from './monolith';
import type { ComponentContext, LaciaAction, LaciaComponent, LaciaSlot, RigHandle } from './components';

/** Attributes every part root carries so the rig can toggle it without DOM surgery. */
const attrs = (comp: string, slot: LaciaSlot) => `data-comp="${comp}" data-slot="${slot}" data-on="1"`;

/* ── lock ──────────────────────────────────────────────────────────────────
 *
 * The four wing plates on her waist. It is a *component*, not part of the
 * device markup, for two reasons: it lives on her body while the device hangs
 * behind her, so it has to mount to the hips bone and inherit that transform;
 * and it is the one piece whose position depends on what she wears (see
 * `LaciaSkin.lock`).
 */
function lockSvg(pos: readonly [number, number] | undefined, slot: LaciaSlot): string {
  const style = pos ? `left:${pos[0]}px;top:${pos[1]}px` : '';
  return `<svg class="lr-device-lock" viewBox="0 0 200 90" aria-hidden="true" ${attrs('lock', slot)}${style ? ` style="${style}"` : ''}>
            <g class="lr-dl-plate"><path d="M100 45 L58 31 L40 42 L60 54 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L58 59 L40 48 L60 36 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L142 31 L160 42 L140 54 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L142 59 L160 48 L140 36 Z"/></g>
            <circle class="lr-dl-core" cx="100" cy="45" r="4.5"/>
          </svg>`;
}

const LOCK: LaciaComponent = {
  id: 'lock',
  slot: 'waist',
  label: { name: 'DEVICE LOCK', code: 'WAIST', note: '腰间四片翼状板，需物主同意' },
  parts: ({ skin }: ComponentContext) => [{ mount: 'hips', html: lockSvg(skin.lock, 'waist') }],
};

/* ── BLACK MONOLITH ────────────────────────────────────────────────────────
 *
 * Four configurations, four actions. A form is persistent state (it stays until
 * another form is chosen); the action is the *motion* of getting there, which
 * is why it has a duration and why the body reaction lives in it.
 */
const FORM_REACTION: Record<LaciaForm, (h: RigHandle) => void> = {
  /* Closing up has no impulse: the plates fold in under their own drive. */
  coffin: () => {},

  /* The rails throw; she absorbs it — hips back, chest back, both arms pushed,
     and the head snaps a beat later once the slug has left. */
  railgun: (h) => {
    h.kick('monRecoil', 420);
    h.kick('hipsX', -11);
    h.kick('chestR', -3.4);
    h.kick('armRR', 5);
    h.kick('armLR', -7);
    /* She drops her weight to take the recoil. Without this the upper body
       braces while the legs stay in the neutral standing pose, and the pose
       reads as pasted-on above the waist. */
    h.impulse('kneeRR', 3.4);
    h.impulse('kneeLR', 2.6);
    h.impulse('monHit', -3.2);
    h.after(260, () => h.kick('headR', -13));
  },

  /* Nothing is thrown, so nothing recoils — it just settles. */
  shield: () => {},

  /* Eight plates lock out at once: the heaviest impulse of the four, so the
     biggest swing. */
  unfold: (h) => {
    h.impulse('monHit', -4.4);
    h.kick('headR', -5);
    h.kick('armRR', 4);
    h.kick('armLR', -4);
  },
};

/** How long each configuration takes to settle, in ms. The longest spring
 *  (monHit at 1.1 Hz) needs ~1.6 s to stop being visible. */
const FORM_DURATION: Record<LaciaForm, number> = { coffin: 900, railgun: 1600, shield: 1200, unfold: 1600 };

function formAction(form: LaciaForm): LaciaAction {
  return {
    id: `monolith:${form}`,
    owner: 'monolith',
    label: { name: LACIA_FORM_LABELS[form].name, code: LACIA_FORM_LABELS[form].code },
    duration: FORM_DURATION[form],
    /* Deploying locks the eight plates out of the hub, and the lock's four
       plates are the retaining clips on that mount — they disengage for the
       swing and re-engage when it settles. This is the only cross-component
       rule in the shipped set, and it is transient: the action restores every
       slot when it ends, so the clips come back on their own. */
    visibility: form === 'unfold' ? { waist: false } : undefined,
    onStart: (h) => {
      h.setDeviceForm(form);
      FORM_REACTION[form](h);
    },
  };
}

const MONOLITH: LaciaComponent = {
  id: 'monolith',
  slot: 'device',
  label: { name: 'BLACK MONOLITH', code: 'DEVICE', note: '黑色秘棺 · 四种构型' },
  parts: ({ uid }: ComponentContext) => [
    { mount: 'stage', html: monolithSvg(uid, attrs('monolith', 'device')) },
  ],
  actions: LACIA_FORM_ORDER.map(formAction),
};

/* ── the character's own modules ───────────────────────────────────────────
 *
 * Owner `self`, and not a component: she is always there, so the settings panel
 * never offers to unmount her. No visibility row, which is exactly what makes
 * her modules "show everything" — the default the design calls for. */
export const SELF_ACTIONS: readonly LaciaAction[] = [
  {
    id: 'self:poke',
    owner: 'self',
    label: { name: '受击', code: 'POKE' },
    duration: 900,
    onStart: (h) => {
      h.kick('headR', -11);
      h.kick('headY', 4);
      /* A poke used to move only her head, which is the whole reason she read
         as a bobblehead on a stick. Weight drops into one knee, the hips take a
         small shove, and the knees take it unevenly — she catches herself. */
      h.impulse('kneeRR', 2.8);
      h.impulse('kneeLR', -1.5);
      h.kick('hipsX', 1.6);
      /* The device is socketed to her, so a jolt through her body reaches it
         too. 2.6° is ~50 units at the muzzle, which is the smallest swing that
         reads at the corner-mascot size. On an outfit with no device the spring
         simply drives nothing. */
      h.impulse('monHit', -2.6);
    },
  },
];

/** Everything that can be mounted. Order here is the order in the settings panel. */
export const LACIA_COMPONENTS: Record<string, LaciaComponent> = {
  monolith: MONOLITH,
  lock: LOCK,
};

export type LaciaComponentId = keyof typeof LACIA_COMPONENTS;

export const COMPONENT_IDS = Object.keys(LACIA_COMPONENTS) as LaciaComponentId[];

/**
 * What each outfit mounts by default.
 *
 * Lives here rather than inline on the skins so the admin panel can read it
 * without pulling the whole engine into its bundle: the settings UI needs the
 * defaults to show "what this outfit would mount", and importing `rig.ts` for
 * that would drag the springs, the IK and the markup builder along with it.
 */
export const SKIN_COMPONENT_DEFAULTS: Record<string, readonly string[]> = {
  suit: ['monolith', 'lock'],
  dress: [],
};

/** Resolve ids to components, in slot order, dropping unknown ids.
 *
 * Slot order (not the caller's order) so the server-rendered markup and the
 * hydrated markup cannot disagree about paint order. */
export function resolveComponents(ids: readonly string[]): LaciaComponent[] {
  const want = new Set(ids);
  const out = COMPONENT_IDS.filter((id) => want.has(id)).map((id) => LACIA_COMPONENTS[id]);
  const rank = (c: LaciaComponent) => {
    const i = SLOT_RANK.indexOf(c.slot);
    return i < 0 ? SLOT_RANK.length : i;
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Paint order for mounted parts. Body-outward: the device layer first. */
const SLOT_RANK: readonly LaciaSlot[] = ['device', 'back', 'aura', 'waist', 'torso', 'neck', 'arm', 'hand', 'head', 'face', 'leg', 'foot', 'weapon'];
