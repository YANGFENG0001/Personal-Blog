/**
 * Lacia rig — a real skeleton over the 30 layers See-through split out.
 *
 * The point of this file is that **nothing is warped**. Every part is a rigid
 * bitmap hanging off a bone whose `transform-origin` sits on an anatomical
 * joint, so a motion is an actual rotation about a pivot instead of a shear.
 * (An earlier attempt drove an SVG displacement field instead; scaling a
 * rotation field by a soft spatial weight is a varying rotation, which bends
 * the torso no matter how the weight is tuned.)
 *
 *   root ── hips ─┬ legR / legL
 *                 └ spine ── chest ─┬ armR / armL      (shoulder pivots)
 *                                   ├ torso           (breathing scale only)
 *                                   └ neck ── head ── hairFront
 *   hairBack paints behind the body, so it is not in that chain — it gets the
 *   composed world matrix of the head plus its own lag (see `pose`).
 *
 * Motion is three layers added together: damped springs (under-damped for the
 * head, very soft for the back hair), an idle "looking around" drift that picks
 * a new bearing every few seconds, and saccades — the iris jumps, it never
 * glides, because real eyes do not pan.
 *
 * The hair uses the standard spring-bone formulation: each layer tracks the
 * head's *world* angle through its own spring and the pose is the difference,
 * so the offset is zero at rest and can never oppose the head.
 */
import { LACIA_ANKLE, LACIA_CANVAS, LACIA_ELBOW, LACIA_KNEE, LACIA_PARTS, LACIA_WRIST } from './parts';
import { DRESS_ANKLE, DRESS_ELBOW, DRESS_KNEE, DRESS_PARTS, DRESS_WRIST } from './parts-dress';
import { HARU_ANKLE, HARU_CANVAS, HARU_ELBOW, HARU_FRAME, HARU_KNEE, HARU_PARTS, HARU_WRIST } from './parts-haru';
import { SORA_ANKLE, SORA_CANVAS, SORA_ELBOW, SORA_FRAME, SORA_KNEE, SORA_PARTS, SORA_WRIST } from './parts-sora';
import { CHIBI_ANKLE, CHIBI_CANVAS, CHIBI_ELBOW, CHIBI_FRAME, CHIBI_KNEE, CHIBI_PARTS, CHIBI_WRIST } from './parts-chibi';
import type { LaciaPart } from './parts';
import {
  FACE_IDS,
  FACE_PAD,
  FORM_FACE,
  STATE_FACE,
  BLUSH_STATES,
  browParts,
  faceBasesOf,
  mouthParts,
  type BrowVariant,
  type FaceBases,
  type MouthVariant,
} from './face';
import { buildScript, type SayLine, type VisemeCue } from '../viseme';
import { LACIA_FORM_ORDER, type LaciaForm } from './lines';
import {
  actionList,
  actionVisible,
  visibilityMatrix,
  type MascotAction,
  type MascotComponent,
  type MascotMount,
  type VisibilityMatrix,
} from '../mascot/model';
import type { LaciaSpring, RigHandle } from './handle';
import { resolveComponents, SELF_ACTIONS, SKIN_COMPONENT_DEFAULTS } from './registry';
export { LACIA_COMPONENTS, COMPONENT_IDS, type LaciaComponentId } from './registry';
export type { MascotAction as LaciaAction, MascotComponent as LaciaComponent, MascotSlot as LaciaSlot, VisibilityMatrix } from '../mascot/model';
export { MASCOT_SLOTS as LACIA_SLOTS, SLOT_LABELS } from '../mascot/model';

export type { LaciaForm };

export type LaciaBone =
  | 'root'
  | 'hips'
  | 'spine'
  | 'chest'
  | 'torso'
  | 'neck'
  | 'head'
  | 'hairFront'
  | 'hairBack'
  | 'armR'
  | 'armL'
  | 'legR'
  | 'legL'
  | 'kneeR'
  | 'kneeL'
  | 'elbowR'
  | 'elbowL'
  | 'wristR'
  | 'wristL'
  | 'ankleR'
  | 'ankleL';

export type LaciaState = 'idle' | 'talk' | 'happy' | 'held' | 'sleep';

/** Which bone carries which layer. Unlisted parts (face, eyes, fringe…) ride the head. */
const BONE_OF: Record<string, LaciaBone> = {
  'back hair': 'hairBack',
  'front hair': 'hairFront',
  'handwear-r-up': 'armR',
  'handwear-l-up': 'armL',
  'handwear-r-lo': 'elbowR',
  'handwear-l-lo': 'elbowL',
  'handwear-r-hand': 'wristR',
  'handwear-l-hand': 'wristL',
  'legwear-r-up': 'legR',
  'legwear-l-up': 'legL',
  'legwear-r-lo': 'kneeR',
  'legwear-l-lo': 'kneeL',
  'footwear-l': 'ankleL',
  'footwear-r': 'ankleR',
  neck: 'neck',
  topwear: 'torso',
};

/* ── skins ────────────────────────────────────────────────────────────────
 *
 * A skin is one character in one outfit: the same 30 parts cut out of different
 * artwork. Two properties make a second skin cheap.
 *
 * **Canvas and pose must match**, because the pivots below that are not joints —
 * shoulder, hips, neck — are hand-placed in canvas coordinates. The blue-dress
 * sheet was generated from the battle-suit sheet as a structural reference and
 * then aligned to its alpha bbox, so its canvas is 493x1275 against 493x1276 and
 * every hand-placed pivot transfers unchanged.
 *
 * **Joints are body properties, not garment properties**, so they transfer too.
 * `export_assets.py` can measure them, but only through a silhouette that
 * actually pinches at the joint — on this skin the skirt hides the thigh, so the
 * narrowest row of the leg is the calf and the measured knee lands 175 px low.
 * That is what `--reuse-pivots` exists for.
 */
export interface LaciaSkin {
  /** Bitmap directory, with trailing slash. */
  base: string;
  parts: readonly LaciaPart[];
  knee: { readonly r: readonly [number, number]; readonly l: readonly [number, number] };
  elbow: { readonly r: readonly [number, number]; readonly l: readonly [number, number] };
  wrist: { readonly r: readonly [number, number]; readonly l: readonly [number, number] };
  ankle: { readonly r: readonly [number, number]; readonly l: readonly [number, number] };
  /** Layer ids this skin introduces that the base bone map does not know. */
  bone?: Readonly<Record<string, LaciaBone>>;
  /**
   * Which optional components this outfit ships with.
   *
   * The battle suit mounts the device and the lock; the blue dress mounts
   * neither, which is the whole point of the split — a component that is not
   * enabled contributes no markup and no actions, so "this outfit has no
   * weapon" needs no special case anywhere in the engine.
   */
  components?: readonly string[];
  /**
   * Refuse a caller-supplied component list.
   *
   * A skin cut from an illustration that has no device in it cannot be given
   * one: there are no mount points to hang it on, so a `monolith` mounted on
   * haru would be a fan of black plates floating beside a schoolgirl. The corner
   * mascot's component setting is authored for 蕾西亚's rig and must not travel
   * when the user switches character — `noOverride` says exactly that, so no
   * code anywhere has to ask who the character is.
   */
  noOverride?: boolean;
  /**
   * Where the device lock sits, in canvas px (top-left of its 200x90 box).
   *
   * Only consulted when the `lock` component is mounted. It is a skin property
   * because the lock is a waist-mounted plate at z-index 8: on the battle suit
   * it lands on the white hip armour, while the same coordinates on a different
   * outfit could land on fabric, where a pale four-blade shape reads as a hole
   * torn in the cloth. An outfit that mounts no lock ignores this.
   */
  lock?: readonly [number, number];
  /**
   * Layer canvas size, in canvas px. Defaults to Lacia's 493x1276.
   *
   * A character is not a costume: her figure is a different width, so the export
   * crops the layer space to *her* content box and the canvas comes out narrower.
   * The stage is sized from this, which is the only reason a second character
   * does not sit off-centre in a 493px box.
   */
  canvas?: { readonly w: number; readonly h: number };
  /**
   * The thirteen pivots that are not joints (hips, chest, shoulders, neck, head,
   * hair). Derived from the layers by `export_assets.py`; the global table below
   * is only the battle suit's copy of them.
   */
  frame?: Readonly<Record<string, readonly [number, number]>>;
  /**
   * Directory holding the 14 baked expression variants. Defaults to Lacia's.
   *
   * A variant is a *bent copy of one character's own bitmap*, so it cannot be
   * shared between characters the way it is shared between Lacia's two outfits.
   */
  faceBase?: string;
}

const SUIT_SKIN: LaciaSkin = {
  base: '/lacia-rig/parts/',
  parts: LACIA_PARTS,
  knee: LACIA_KNEE,
  elbow: LACIA_ELBOW,
  wrist: LACIA_WRIST,
  ankle: LACIA_ANKLE,
  components: SKIN_COMPONENT_DEFAULTS.suit,
};

/**
 * The blue dress. See-through split it into `topwear` + `bottomwear` instead of
 * welding the skirt to the bodice, which is the right call — a skirt hangs from
 * the waist and a bodice from the chest. Both ride `torso` here, so they can
 * never separate at the belt.
 */
const DRESS_SKIN: LaciaSkin = {
  base: '/lacia-rig/dress/',
  parts: DRESS_PARTS,
  knee: DRESS_KNEE,
  elbow: DRESS_ELBOW,
  wrist: DRESS_WRIST,
  ankle: DRESS_ANKLE,
  bone: { bottomwear: 'torso' },
  /* No device and no lock. Both are optional components now, so this is the
     entire statement of "this outfit carries no weapon" — there is no branch
     anywhere in the rig that asks which outfit it is. */
  components: SKIN_COMPONENT_DEFAULTS.dress,
};

/**
 * A second character, not a second outfit.
 *
 * She is a rig skin like the others because a skin is exactly "bitmap directory +
 * coordinates + four joints + which optional components are mounted" — and that
 * list has nothing to do with who the person is. The differences that *are*
 * about her (canvas width, the thirteen body pivots) live in `canvas` / `frame`,
 * which is why this is a data entry and not a branch in the engine.
 *
 * She mounts no device: `components: []` is the whole statement of that.
 */
export const HARU_SKIN: LaciaSkin = {
  base: '/lacia-rig/haru/',
  parts: HARU_PARTS,
  knee: HARU_KNEE,
  elbow: HARU_ELBOW,
  wrist: HARU_WRIST,
  ankle: HARU_ANKLE,
  canvas: HARU_CANVAS,
  frame: HARU_FRAME,
  faceBase: '/lacia-rig/haru/',
  /* See-through cut her skirt as its own `bottomwear` layer instead of welding
     it to the blouse, exactly as it did on the blue dress. A skirt hangs from
     the waist, so it rides the torso — unlisted ids default to the head, which
     would make the pleats turn with her chin. The flower clip is pinned to her
     hair, so it rides the fringe rather than the skull. */
  bone: { bottomwear: 'torso', headwear: 'hairFront' },
  components: [],
  noOverride: true,
};

/**
 * The third character, and the one whose design was chosen *for* the pipeline.
 *
 * 小晴's first two drafts had a hooded rain jacket, and the split put both
 * sleeves and the hood into a single `handwear` layer — one connected blob of
 * garment that no connected-component split can separate, because the hood is
 * physically joined to the sleeves. Choosing a stand collar instead of a hood
 * is not a costume preference here; it is what makes the layer split come back
 * as two arms.
 */
export const SORA_SKIN: LaciaSkin = {
  base: '/lacia-rig/sora/',
  parts: SORA_PARTS,
  knee: SORA_KNEE,
  elbow: SORA_ELBOW,
  wrist: SORA_WRIST,
  ankle: SORA_ANKLE,
  canvas: SORA_CANVAS,
  frame: SORA_FRAME,
  faceBase: '/lacia-rig/sora/',
  /* `orphan` is the braid the split dropped (see the recovery step in
     `export_assets.py`). It hangs off the back hair so it lags the head the way
     a braid does, and so the end that was tucked behind her hair stays tucked —
     `hairBack` paints behind the whole body. */
  bone: { bottomwear: 'torso', headwear: 'hairFront', orphan: 'hairBack' },
  components: [],
  noOverride: true,
};

/**
 * The Q-version, and the one skin whose rig is honestly *partial*.
 *
 * At two and a half heads her thighs touch, so the split could not find two
 * legs and there is no knee to measure. `export_assets.py` pins the knee to the
 * hip rather than guessing one at 45% of a shape with no pinch, and her single
 * `legwear` layer rides the hips: the lower body is rigid and swings as one
 * piece. That is not a compromise for a chibi — a chibi's legs *are* one shape,
 * and the alternative is a shin that swings from mid-thigh.
 *
 * Her arms are the opposite: they came out as two separate layers and the
 * elbow and wrist were measured normally, so those joints are real.
 */
export const CHIBI_SKIN: LaciaSkin = {
  base: '/lacia-rig/chibi/',
  parts: CHIBI_PARTS,
  knee: CHIBI_KNEE,
  elbow: CHIBI_ELBOW,
  wrist: CHIBI_WRIST,
  ankle: CHIBI_ANKLE,
  canvas: CHIBI_CANVAS,
  frame: CHIBI_FRAME,
  faceBase: '/lacia-rig/chibi/',
  /* `legwear` is the fused pair, so it hangs off the hips; `orphan` is the rim
     the split left uncovered, which belongs to the body rather than the head. */
  bone: { legwear: 'hips', bottomwear: 'torso', orphan: 'hips' },
  components: [],
  noOverride: true,
};

export const LACIA_SKINS = {
  suit: SUIT_SKIN,
  dress: DRESS_SKIN,
  haru: HARU_SKIN,
  sora: SORA_SKIN,
  chibi: CHIBI_SKIN,
} as const;
export type LaciaSkinId = keyof typeof LACIA_SKINS;

/** Which skin a corner mascot should wear. A character with only one outfit
 *  ignores the outfit setting rather than silently wearing someone else's. */
export function skinForCharacter(character: string, outfit: string): LaciaSkinId {
  if (character === 'haru') return 'haru';
  if (character === 'sora') return 'sora';
  if (character === 'chibi') return 'chibi';
  return outfit === 'dress' ? 'dress' : 'suit';
}

/** Canvas size of a skin, falling back to the original figure. */
export function canvasOf(skin: LaciaSkin): { readonly w: number; readonly h: number } {
  return skin.canvas ?? LACIA_CANVAS;
}

/**
 * The custom properties that describe a skin's canvas, for the host to put on
 * `.lr` as an inline style.
 *
 * These used to be constants in `lacia-rig.css` (493x1276, origin 246/700), which
 * was fine while every skin was Lacia in a different outfit: the export aligns
 * skins to the same alpha box, so a second *costume* really does share the
 * canvas. A second *character* does not — haru's figure is 328 wide at the same
 * height — so the four numbers have to travel with the skin.
 *
 * The origin is her root pivot, not the canvas centre. On Lacia those coincide
 * (246 vs 493/2) and that is a coincidence of her pose, not a rule: haru's hips
 * sit at y=543 of 1277, nowhere near the middle, and rotating her about the
 * canvas centre would swing her feet instead of her waist.
 */
export function canvasCss(skin: LaciaSkin): Record<string, string> {
  const c = canvasOf(skin);
  const [rx, ry] = pivotTable(skin).root;
  return {
    '--lr-cw': String(c.w),
    '--lr-ch': String(c.h),
    '--lr-cp-x': String(rx),
    '--lr-cp-y': String(ry),
    '--lr-k': (1 / c.h).toFixed(8),
    '--lr-ar': (c.w / c.h).toFixed(4),
    /* The device's hub is her waist, so it moves with the root pivot. */
    '--lr-mon-x': String(rx),
    '--lr-mon-y': String(ry),
  };
}

/** Joint positions, in canvas px. */
type JointBone = 'kneeR' | 'kneeL' | 'elbowR' | 'elbowL' | 'wristR' | 'wristL' | 'ankleR' | 'ankleL';

/** Pivots that do not move between skins: hand-placed, not measured. */
const FIXED_PIVOT: Record<Exclude<LaciaBone, JointBone>, readonly [number, number]> = {
  root: [246, 700],
  hips: [246, 700],
  spine: [246, 700],
  chest: [246, 660],
  torso: [246, 444],
  neck: [235, 214],
  head: [235, 186],
  hairFront: [235, 160],
  hairBack: [235, 190],
  armR: [162, 252],
  armL: [318, 250],
  legR: [200, 500],
  legL: [300, 500],
};

function pivotTable(skin: LaciaSkin): Record<LaciaBone, readonly [number, number]> {
  return {
    ...FIXED_PIVOT,
    ...((skin.frame ?? {}) as Partial<Record<LaciaBone, readonly [number, number]>>),
    kneeR: skin.knee.r,
    kneeL: skin.knee.l,
    elbowR: skin.elbow.r,
    elbowL: skin.elbow.l,
    wristR: skin.wrist.r,
    wristL: skin.wrist.l,
    ankleR: skin.ankle.r,
    ankleL: skin.ankle.l,
  };
}

const EYE = new Set(['eyewhite-r', 'eyewhite-l', 'irides-r', 'irides-l', 'eyelash-r', 'eyelash-l']);

export interface LaciaRigOptions {
  /** Directory holding the part bitmaps. */
  base?: string;
  /** Which outfit the figure wears. Defaults to the battle suit. */
  skin?: LaciaSkinId;
  /**
   * Optional components to mount. Defaults to the skin's own set, which is how
   * an outfit with no weapon stays weaponless without the engine branching on
   * the outfit id.
   */
  components?: readonly string[];
  /** Namespace for the device's gradient ids; one per mounting variant. */
  uid?: string;
  /** Skip the animation loop (prefers-reduced-motion / 动效关闭). */
  reduced?: boolean;
  /** Idle amplitude multiplier. */
  energy?: number;
  /** Cycle the device through its forms while idle. */
  autoForms?: boolean;
  /** Called on every form change; `manual` is true for user-driven switches. */
  onForm?: (form: LaciaForm, manual: boolean) => void;
}

/* ── markup ─────────────────────────────────────────────────────────────── */

/**
 * Which components an outfit mounts: the caller's list if it gave one,
 * otherwise the skin's own.
 */
export function skinComponents(skin: LaciaSkinId, override?: readonly string[]): MascotComponent<RigHandle, LaciaSkin>[] {
  const s = LACIA_SKINS[skin];
  /* `noOverride` is a skin that was cut from art with no device in it — the
     caller's list belongs to a different character's rig, so it is dropped
     rather than mounted into thin air. */
  return resolveComponents((s.noOverride ? s.components : (override ?? s.components)) ?? []);
}

/** The action list for an outfit — what the device console and any settings
 *  panel should offer. Character modules come first, then each component's. */
export function laciaActions(skin: LaciaSkinId, override?: readonly string[]): MascotAction<RigHandle>[] {
  return [...SELF_ACTIONS, ...actionList(skinComponents(skin, override))];
}

function partsFor(skin: LaciaSkin): Record<string, string> {
  const out: Record<string, string> = {};
  const boneOf = skin.bone ? { ...BONE_OF, ...skin.bone } : BONE_OF;
  for (const p of skin.parts) {
    /* Brows and mouth are replaced by the variant stack below — the raw
       exports would otherwise sit under it and show through the cross-fade. */
    if (FACE_IDS.has(p.id)) continue;
    const bone = boneOf[p.id] ?? 'head';
    const img =
      `<img class="lr-part" src="${skin.base}${p.file}" alt="" draggable="false" decoding="async"` +
      ` width="${p.w}" height="${p.h}"` +
      ` style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.z}">`;
    out[bone] = (out[bone] ?? '') + img;
  }
  return out;
}

/** One stacked image per variant; `opacity` picks the shape, not `src`, so a
 *  change cross-fades instead of flashing an unloaded file. */
/**
 * The feature variants (4 brows x 2 sides, 6 mouths) are *character* assets, not
 * costume ones: they are the same person's eyebrows in either outfit.
 *
 * On the battle suit and the blue dress that means they are *shared* files. The
 * dress was generated from the suit sheet as a structural reference, so its brow
 * lands at (187,94) against (185,93) and its mouth at (231,163) against
 * (230,162) — 1–2 px, invisible at the 9 px the feature is actually drawn at.
 * Re-cutting 14 variant files per outfit would buy nothing, so both point here.
 *
 * A second *character* is different: her brow is 42x16 where Lacia's is 45x7,
 * so the bent variants have to be baked from her own bitmap. That is what
 * `LaciaSkin.faceBase` is for — it defaults to this directory and haru overrides
 * it. Nothing branches on the character id.
 */
const FACE_BASE = '/lacia-rig/parts/';

function faceStack(base: string, bases: FaceBases): string {
  const img = (p: { file: string; x: number; y: number; w: number; h: number; z: number }, v: string, group: string, on: boolean) =>
    `<img class="lr-part lr-face" data-face="${group}" data-v="${v}"${on ? ' data-on' : ''}` +
    ` src="${base}${p.file}" alt="" draggable="false" decoding="async"` +
    ` width="${p.w}" height="${p.h}"` +
    ` style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.z}">`;

  return [
    ...(['r', 'l'] as const).flatMap((side) =>
      browParts(side, bases).map(({ v, part }) => img(part, v, `brow-${side}`, v === 'neutral')),
    ),
    ...mouthParts(bases).map(({ v, part }) => img(part, v, 'mouth', v === 'neutral')),
  ].join('');
}

/** Cheek flush: two soft gradients, painted between the face and the eyes.
 *  Placed as fractions of the face box, which is where the 188/141 pair on the
 *  battle suit came from in the first place. */
function blushOf(face: LaciaPart): string {
  const x = face.x + face.w * 0.13;
  const y = face.y + face.h * 0.74;
  const w = face.w * 0.25;
  const h = face.h * 0.09;
  const one = (left: number) =>
    `<div class="lr-blush" style="left:${left.toFixed(0)}px;top:${y.toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px"></div>`;
  return one(x) + '\n                  ' + one(face.x + face.w * 0.64);
}

/**
 * Server-renderable skeleton. The island renders this string so the figure is
 * painted before any JavaScript runs; `LaciaRig` then adopts the same nodes.
 */
export function laciaMarkup(
  opts: { base?: string; uid?: string; skin?: LaciaSkinId; components?: readonly string[] } = {},
): string {
  const skinId = opts.skin ?? 'suit';
  const skin = LACIA_SKINS[skinId];
  const base = opts.base ?? skin.base;
  const uid = opts.uid ?? 'lacia-mono';
  const p = partsFor({ ...skin, base });

  /* Where the brow and mouth sit is a property of her face, so it is read from
     her own part table rather than from the constants `face.ts` used to hold. */
  const bases = faceBasesOf(skin.parts);
  const faceDir = skin.faceBase ?? FACE_BASE;
  const face = skin.parts.find((x) => x.id === 'face');
  if (!face) throw new Error('rig: skin has no face layer');
  const blush = blushOf(face);

  /* Components are rendered into their mount points. Nothing here knows what a
     component is — an outfit with no device simply contributes no markup. */
  const byMount = new Map<MascotMount, string>();
  for (const comp of skinComponents(skinId, opts.components)) {
    for (const part of comp.parts({ uid, subject: skin })) {
      byMount.set(part.mount, (byMount.get(part.mount) ?? '') + part.html);
    }
  }
  const at = (m: MascotMount) => byMount.get(m) ?? '';

  return `<div class="lr-stage">
      <div class="lr-bones">
        <div class="lr-bone lr-hairback" data-bone="hairBack">${p.hairBack ?? ''}</div>
        <div class="lr-bone lr-root" data-bone="root">
          <div class="lr-bone lr-hips" data-bone="hips">
            ${p.hips ?? ''}${at('hips')}
            <div class="lr-bone lr-leg" data-bone="legR">
              <div class="lr-bone lr-knee" data-bone="kneeR">
                <div class="lr-bone lr-ankle" data-bone="ankleR">${p.ankleR ?? ''}</div>${p.kneeR ?? ''}
              </div>${p.legR ?? ''}
            </div>
            <div class="lr-bone lr-leg" data-bone="legL">
              <div class="lr-bone lr-knee" data-bone="kneeL">
                <div class="lr-bone lr-ankle" data-bone="ankleL">${p.ankleL ?? ''}</div>${p.kneeL ?? ''}
              </div>${p.legL ?? ''}
            </div>
            <div class="lr-bone lr-spine" data-bone="spine">
              <div class="lr-bone lr-chest" data-bone="chest">
                ${at('chest')}
                <div class="lr-bone lr-arm" data-bone="armR">
                  <div class="lr-bone lr-elbow" data-bone="elbowR">
                    <div class="lr-bone lr-wrist" data-bone="wristR">${p.wristR ?? ''}${at('wristR')}</div>${p.elbowR ?? ''}
                  </div>${p.armR ?? ''}
                </div>
                <div class="lr-bone lr-arm" data-bone="armL">
                  <div class="lr-bone lr-elbow" data-bone="elbowL">
                    <div class="lr-bone lr-wrist" data-bone="wristL">${p.wristL ?? ''}${at('wristL')}</div>${p.elbowL ?? ''}
                  </div>${p.armL ?? ''}
                </div>
                <div class="lr-bone lr-torso" data-bone="torso">${p.torso ?? ''}</div>
                <div class="lr-bone lr-neck" data-bone="neck">${p.neck ?? ''}
                  <div class="lr-bone lr-head" data-bone="head">${p.head ?? ''}${blush}${faceStack(faceDir, bases)}${at('head')}
                    <div class="lr-bone lr-hairfront" data-bone="hairFront">${p.hairFront ?? ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${at('stage')}
    </div>`;
}

/* ── spring ─────────────────────────────────────────────────────────────── */

class Spring {
  x: number;
  v = 0;
  constructor(
    readonly hz: number,
    readonly zeta: number,
    v = 0,
  ) {
    this.x = v;
  }
  step(target: number, dt: number) {
    const w0 = 2 * Math.PI * this.hz;
    this.v += (w0 * w0 * (target - this.x) - 2 * this.zeta * w0 * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }
  kick(v: number) {
    this.v += v;
  }
  /** Impulse sized by the peak *displacement* it should produce, in the same
   *  units as the spring.
   *
   *  `kick()` adds to velocity, so one number means different things on springs
   *  of different stiffness — `kick(-3.5)` peaks at 0.5° on the device
   *  (0.55 Hz) and would peak at 0.16° on a 2 Hz joint. That is how the device
   *  ended up with a recoil nobody could see: the call site said "jolt" and the
   *  spring delivered half a degree. Anything meant to be visible on screen
   *  asks for degrees and lets the spring work out the velocity.
   *
   *  Exact peak of a damped spring released from rest with velocity v0:
   *    t_peak = atan(wd / (ζ·w0)) / wd,   x_peak = (v0/wd)·e^(−ζ·w0·t)·sin(wd·t) */
  impulse(peak: number) {
    const w0 = 2 * Math.PI * this.hz;
    const wd = w0 * Math.sqrt(1 - this.zeta * this.zeta);
    const t = Math.atan(wd / (this.zeta * w0)) / wd;
    const gain = (Math.exp(-this.zeta * w0 * t) * Math.sin(wd * t)) / wd;
    this.v += peak / gain;
  }
}

/* ── 2D affine matrices ─────────────────────────────────────────────────────
   The back hair paints behind the body, so it cannot be a DOM child of the
   head — but it still has to move with the whole chain. Rather than faking
   that with a fraction of the head angle, the rig composes the real world
   matrix of the head and hangs the hair off it (a socket attachment, the same
   thing every engine does when a prop must live in another paint layer). */
type Mat = readonly [number, number, number, number, number, number];

const matMul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const matMove = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const matRot = (deg: number): Mat => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
};
/** Rotate/scale about a pivot: T(p) · m · T(-p). */
const matAbout = (m: Mat, px: number, py: number): Mat => matMul(matMul(matMove(px, py), m), matMove(-px, -py));
/** Apply a matrix to a point. */
const matPt = (m: Mat, x: number, y: number): readonly [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
/** Inverse of an affine matrix. Used to bring a world-space contact target into
 *  the frame the arm actually lives in — see `armIk`'s call site. */
const matInv = (m: Mat): Mat => {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};

/* ── two-bone IK for the arm that is holding something ──────────────────────
 *
 * The arm is shoulder → elbow → palm, three pivots and two rigid lengths, so
 * "put the palm there" is the textbook two-link problem and has a closed-form
 * answer. Solving it is the difference between a pose that *points at* the
 * device and a pose that *rests on* it: with fixed angles the palm drifts a
 * few pixels every breath, because the shoulder it hangs from is moving and
 * the arm is not compensating. That drift is small but it is exactly what the
 * eye uses to decide whether two objects are touching.
 *
 * The palm is taken from the hand bitmap's own box rather than hand-typed, so
 * it stays correct if the layers are ever re-split — same rule as the joint
 * pivots. The two solutions are the elbow up and the elbow down; a human elbow
 * drops below the shoulder-to-palm line when the hand is raised in front of the
 * chest, which is the only case this is used for, so the "elbow down" branch is
 * taken unconditionally.
 */
type ArmChain = Record<
  'r' | 'l',
  {
    shoulder: readonly [number, number];
    elbow: readonly [number, number];
    palm: readonly [number, number];
  }
>;

function armChain(skin: LaciaSkin): ArmChain {
  const piv = pivotTable(skin);
  const palmOf = (id: string) => {
    const p = skin.parts.find((q) => q.id === id);
    if (!p) return [0, 0] as const;
    return [p.x + p.w / 2, p.y + p.h / 2] as const;
  };
  return {
    r: { shoulder: piv.armR, elbow: piv.elbowR, palm: palmOf('handwear-r-hand') },
    l: { shoulder: piv.armL, elbow: piv.elbowL, palm: palmOf('handwear-l-hand') },
  };
}

function armIk(chain: ArmChain, side: 'r' | 'l', tx: number, ty: number): { arm: number; elbow: number } {
  const { shoulder: S, elbow: E, palm: M } = chain[side];
  const ux = E[0] - S[0];
  const uy = E[1] - S[1];
  const wx = M[0] - E[0];
  const wy = M[1] - E[1];
  const L1 = Math.hypot(ux, uy);
  const L2 = Math.hypot(wx, wy);
  const a0 = Math.atan2(uy, ux);
  const g0 = Math.atan2(wy, wx);
  const dx = tx - S[0];
  const dy = ty - S[1];
  /* Clamped 1 unit inside full extension. At exactly L1+L2 the law of cosines
     divides by zero and the spring gets NaN, which silently kills the whole
     bone for the rest of the session. */
  const d = Math.min(L1 + L2 - 1, Math.max(Math.abs(L1 - L2) + 1, Math.hypot(dx, dy)));
  const phi = Math.atan2(dy, dx);
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  /* Two solutions, mirrored about the shoulder-to-palm line: elbow above it or
     elbow below it. Picking by *sign* is how this ended up with her elbow up
     near her ear. A human elbow hangs, so the branch is chosen by geometry —
     whichever solution puts the elbow lower on screen — and that stays correct
     for any target without a special case per form. */
  const cand = [phi - A, phi + A].map((ang) => ({
    ang,
    ey: S[1] + Math.sin(ang) * L1,
  }));
  const absArm = cand[0].ey >= cand[1].ey ? cand[0].ang : cand[1].ang;
  const ex = S[0] + Math.cos(absArm) * L1;
  const ey = S[1] + Math.sin(absArm) * L1;
  const fore = Math.atan2(ty - ey, tx - ex);
  const arm = ((absArm - a0) * 180) / Math.PI;
  const elbow = ((fore - g0) * 180) / Math.PI - arm;
  return { arm, elbow };
}

const ENERGY: Record<LaciaState, number> = { idle: 1, talk: 1.15, happy: 1.3, held: 1.7, sleep: 0.4 };

/**
 * Idle motion budget.
 *
 * The whole-body sway was tuned up in the same pass that added the secondary
 * motion (chest lag, neck drift, wrist settle), and that double-counted: the
 * pelvis rocking and the chest lagging behind it add up, so the figure ended up
 * visibly rolling from foot to foot while standing still. The fix is not to
 * remove the sway — a figure that holds perfectly still is worse — but to spend
 * the budget on the *late* motion and take it out of the *early* motion. The
 * pelvis and legs get 0.6; everything downstream (chest, neck, head) keeps its
 * amplitude, so what is left reads as breathing and weight rather than rocking.
 */
const IDLE = 0.6;

/**
 * How her body answers each device form, in degrees (and canvas px for rootY).
 *
 * These are pose *targets* the springs chase, so a form switch eases in instead
 * of snapping.
 *
 * **Arm signs are the thing that was wrong here, and it was wrong for a long
 * time.** A single shoulder joint is all the art allows — `handwear-l/r` are
 * one rigid bitmap each, shoulder to fingertips — so an arm can only swing, and
 * the sign of that swing decides whether it reaches for the device or folds
 * away from it. The device sits at canvas x 398–546, her left hand rests at
 * about x 380, so the near arm is `armL` (pivot 318,250). Rotating `armL`
 * *negative* swings that hand outward toward the rails; positive folds it
 * across her body. The first version had `armL: +14` for the railgun, which
 * tucked the arm in — the pose said "bracing on the rail" and the picture said
 * "hugging herself". For `armR` (pivot 162,252) the sign is the opposite:
 * positive is outward.
 *
 *   coffin  — nothing deployed, she just stands.
 *   railgun — mass projection: weight back and down, chest turned toward the
 *             device, near arm out to the rail, far arm counterweighting.
 *   shield  — barrier: weight forward, near arm brought across in front of her
 *             torso, far arm tucked.
 *   unfold  — the escort claw is out: chest open, both arms away from the body.
 *
 * The head values are *rolls*, not nods — a 2D rig has no pitch axis, so "head
 * lowered along the barrel" can only be a tilt.
 *
 * ## Why there are legs in here now
 *
 * This table used to describe the body from the waist up, and every form stood
 * on exactly the same pair of legs. That is the actual source of "摆动作的时候
 * 身体僵硬": the arms and chest moved to a new pose, the legs did not, so the
 * silhouette changed above the waist and stayed a mannequin below it. Worse,
 * `railgun` sets `rootY: 9` — it lowered the pelvis 9 px without bending a knee,
 * which does not read as "dropping her weight", it reads as sinking into the
 * floor (measured: her soles sat 10 px lower in that form than in `coffin`).
 *
 * A knee bend is also the *only* thing that can absorb `rootY` in this rig,
 * because the chain is rooted at the hips: the legs hang off the pelvis, so
 * lowering the pelvis drags the feet down with it. Bending the knee shortens the
 * hip-to-sole distance by `L1·L2·(1−cos φ)/L`, which is ~2.6 px per 10° on
 * these proportions — so `rootY` and `knee` have to be chosen together, and
 * `verify/stance.cjs` asserts the soles stay put.
 *
 * Sign of `legR` / `legL` (both positive = both feet travel screen-left, which
 * is why the shared `sway` term can drive them with the same expression):
 * a **wider** stance is `legR > 0, legL < 0`.
 */
const FORM_POSE: Record<
  LaciaForm,
  {
    rootY: number; hipsX: number; spine: number; chest: number; head: number;
    armR: number; armL: number; elbowR: number; elbowL: number; wristR: number; wristL: number;
    legR: number; legL: number; shinR: number; shinL: number;
  }
> = {
  /* Resting. Not zero on the legs: a figure standing with both feet exactly
     symmetric is the one silhouette nobody ever stands in. 1.4° of thigh and
     half a degree of knee is enough to say "she is standing on one hip a
     little" without becoming a pose. */
  coffin: {
    rootY: 0, hipsX: 0, spine: 0, chest: 0, head: 0,
    armR: 0, armL: 0, elbowR: 0, elbowL: 0, wristR: 0, wristL: 0,
    legR: 1.4, legL: -1.4, shinR: 0.4, shinL: -0.4,
  },
  /* Mass projection. This is the pose from the official figure: she is not
     "standing near the weapon", she is **resting on it** — hip cocked toward
     the casket, weight through the near leg, far leg soft and turned out, near
     hand lying on the rail at chest height. The near arm's angles are not in
     this table at all: they come from the two-bone IK in `armIk`, which is the
     only way the palm stays on the rail while the body moves under it. */
  railgun: {
    rootY: 2, hipsX: 7, spine: -2, chest: -5, head: 5,
    armR: 2, armL: 0, elbowR: 4, elbowL: 0, wristR: 0, wristL: 0,
    legR: 5.0, legL: -1.0, shinR: 2.6, shinL: 0.4,
  },
  /* Barrier. Weight forward and down, feet wide, near forearm across the chest
     with the palm pressed to the plate — again solved, not posed. */
  shield: {
    rootY: 2.5, hipsX: -4, spine: -2, chest: -6, head: 4,
    armR: -6, armL: 0, elbowR: -4, elbowL: 0, wristR: 0, wristL: 0,
    legR: 6.2, legL: -6.2, shinR: 1.8, shinL: -1.8,
  },
  /* Escort claw deployed. Chest open, arms away from the body, feet planted
     apart — she is holding the fan up, so the stance has to be a base rather
     than a stance. `rootY: -5` is gone: lifting the pelvis off straight legs
     just levitates her 5 px. */
  unfold: {
    rootY: 2, hipsX: 2, spine: 1, chest: -4, head: -3,
    armR: 10, armL: -19, elbowR: 6, elbowL: -13, wristR: 0, wristL: 0,
    legR: 5.4, legL: -5.4, shinR: 1.4, shinL: -1.4,
  },
};

/**
 * Where the near hand is planted, in canvas units, per form.
 *
 * The point is expressed **in the hips' frame**, not in screen space, because
 * the device is socketed at her waist: the rail is rigidly bolted to the pelvis,
 * so a point on the rail travels with the pelvis and not with the chest. Feeding
 * that through `armIk` is what makes the contact survive the idle motion — the
 * chest breathes, the shoulder moves, and the arm re-solves so the palm stays
 * on the rail. Without it the hand slides a few pixels every breath, which is
 * the single clearest tell that two things are being animated independently.
 *
 * `wrist` is the hand's own angle *after* the IK: the rail runs roughly
 * vertically past her palm, so the hand keeps close to its rest orientation
 * (`0`) and only rolls a little to lie along the edge.
 */
const HAND_PLANT: Partial<
  Record<LaciaForm, { side: 'r' | 'l'; at: readonly [number, number]; wrist: number; frame: 'device' | 'hips' }>
> = {
  /* On the near rail's face. The height is not "chest height because the
     reference art has it there" — it is wherever a **hanging elbow** puts the
     palm, which on this rig is hip height. The upper arm here is only 105 units
     long against a 260-unit forearm-plus-hand, so reaching up to the sternum
     forces the elbow either across her chest or up by her ear; both read as
     broken. Asking for the point the arm can actually rest on gives an elbow
     directly below the shoulder and a palm flat on the rail — which is the
     pose the reference is actually showing, one hand's width lower. */
  railgun: { side: 'l', at: [515, 492], wrist: -8, frame: 'device' },
  /* Palm flat on the barrier, in front of the sternum. `hips`, not `device`:
     the barrier is a projected plane, and its plates carry their own unfolding
     choreography — a hand locked to a plate would ride that animation instead
     of holding still against the field. The field is fixed relative to her, so
     the pelvis is the right parent. */
  shield: { side: 'l', at: [330, 450], wrist: 10, frame: 'hips' },
};

/** Gaze bias per form. */
const FORM_GAZE: Record<LaciaForm, readonly [number, number]> = {
  coffin: [0, 0],
  railgun: [1.1, -0.5], // down the barrel, which is off her left
  shield: [0, 0.2], // straight ahead, at whatever the barrier is stopping
  unfold: [0, -0.8], // up at the escort claw
};

/**
 * Facial expression, as *displacement* laid on top of the variant bitmaps.
 *
 * Since `face.ts` bakes the actual shapes (furrow / raise / smile / open), this
 * table is now only the small continuous part — a couple of pixels of travel and
 * a degree or two of tilt, so the face is not frozen while a shape is held. The
 * large offsets it used to carry are gone on purpose: they were compensating
 * for missing art, and stacking both would double-count the expression.
 *
 * `tilt` is positive when the **inner** ends drop (focused / annoyed).
 */
interface Expr {
  /** px, negative = raised. */
  browY: number;
  /** deg, positive = inner ends down. */
  tilt: number;
  /** scaleY of the mouth; 1 = as drawn (closed). */
  open: number;
  /** scaleX of the mouth. */
  wide: number;
}

const NEUTRAL: Expr = { browY: 0, tilt: 0, open: 1, wide: 1 };

const EXPR_STATE: Record<LaciaState, Expr> = {
  idle: NEUTRAL,
  talk: { browY: -0.5, tilt: 0, open: 1, wide: 1 }, // `open` is pulsed in tick()
  happy: { browY: -0.8, tilt: -1.6, open: 1.04, wide: 1.04 },
  held: { browY: -2.2, tilt: -0.6, open: 1.06, wide: 0.94 },
  /* The sag lives in the `drop` bitmap now, so the spring only adds a touch —
     stacking the old +1.6 on top of a brow that is already 2px lower would
     walk the strip into her lash line. */
  sleep: { browY: 0.6, tilt: 0, open: 0.95, wide: 0.96 },
};

/**
 * How each device form reads on her face. Multiplied onto the state, so a
 * form never erases a mood — `sleep` + `railgun` is still a lowered brow.
 * The shape itself comes from `FORM_FACE` in face.ts; this is the motion.
 */
const EXPR_FORM: Record<LaciaForm, Expr> = {
  coffin: NEUTRAL,
  railgun: { browY: -0.4, tilt: 1.4, open: 0.95, wide: 0.97 }, // sighting down the rail
  shield: { browY: -0.8, tilt: 1.0, open: 1.02, wide: 1 }, // braced
  unfold: { browY: -0.6, tilt: -1.0, open: 1.04, wide: 1.02 }, // watching the claw
};

/* ── the rig ────────────────────────────────────────────────────────────── */

export class LaciaRig implements RigHandle {
  readonly el: HTMLElement;
  private readonly bones = new Map<LaciaBone, HTMLElement>();
  private readonly eyes: HTMLImageElement[] = [];
  private readonly irises: HTMLImageElement[] = [];
  /** Group ('brow-r' | 'brow-l') → every variant image of that brow. */
  private readonly brows = new Map<string, HTMLImageElement[]>();
  private readonly mouths = new Map<MouthVariant, HTMLImageElement>();
  private browVariant: BrowVariant = 'neutral';
  private mouthVariant: MouthVariant = 'neutral';
  private readonly monolith: SVGElement | null;
  private readonly lock: SVGElement | null;
  /** Mounted components, each with the elements that make it up. */
  private readonly comps: { def: MascotComponent<RigHandle, LaciaSkin>; els: Element[]; on: boolean }[] = [];
  /** Every action the mounted components bring, plus her own modules. */
  private readonly actions: readonly MascotAction<RigHandle>[];
  /** Id of the action currently playing; only one may run at a time. */
  private activeAction: MascotAction<RigHandle> | null = null;
  private actionTimer = 0;
  /** Delayed callbacks owned by the running action, cancelled with it. */
  private actionPending: number[] = [];
  private actionManual = false;
  /** Joint table for this figure's outfit. Joints are body, not garment. */
  private readonly pivot: Record<LaciaBone, readonly [number, number]>;
  /** Shoulder / elbow / palm in canvas coords, for the two-bone IK. */
  private readonly limbs: ArmChain;

  private form: LaciaForm = 'coffin';
  private state: LaciaState = 'idle';
  private energy: number;
  private reduced: boolean;

  private raf = 0;
  private running = false;
  private last = 0;
  private acc = 0;
  private t0 = 0;

  private pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  private gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  /** Current eyelid aperture, 1 = as drawn. Closes instantly, opens eased. */
  private lid = 1;
  private blinkAt = 0;
  private blinkUntil = 0;
  private saccadeAt = 0;
  private turnAt = 0;
  private turnTarget = 0;
  private autoAt = 0;
  private rectAt = 0;
  private rect = { x: 0, y: 0, w: 1, h: 1 };

  /** Absolute-time mouth cues for the line being typed out (see viseme.ts). */
  private script: VisemeCue[] = [];
  private scriptStart = 0;
  private scriptEnd = 0;
  private scriptIdx = 0;
  private blush = false;

  /* Annotated rather than inferred: `Record<LaciaSpring, Spring>` makes this
     table and the vocabulary in components.ts a two-way compile-time check, so
     an action module cannot name a spring that does not exist (nor a spring be
     added without becoming addressable). */
  private readonly S: Record<LaciaSpring, Spring> = {
    rootY: new Spring(1.6, 1.0),
    hipsX: new Spring(0.7, 0.9),
    hipsR: new Spring(0.7, 0.9),
    /* The spine and the ribcage are deliberately *softer and less damped* than
       the hips. A torso that returns to rest as fast as the pelvis it sits on
       has no mass above the waist — which is the whole of "腰部僵硬". 0.72 Hz
       with ζ 0.72 gives roughly a 1.4 s settle: slow enough to see, quick
       enough that it never looks like jelly. */
    spineR: new Spring(0.72, 0.72),
    chestR: new Spring(0.95, 0.66),
    /* The bust is not part of the ribcage. It hangs off it with its own mass, so
       it gets its own, much softer spring: rotation lags the chest and lateral
       drift lags the hips. Both are small — a bust that swings on its own is a
       different, worse problem — but zero here is what makes the chest read as
       a printed T-shirt. */
    torsoR: new Spring(1.15, 0.52),
    torsoShift: new Spring(0.58, 0.6),
    torsoY: new Spring(0.6, 1.0, 1),
    torsoX: new Spring(0.6, 1.0, 1),
    /* The neck is the last link before the head, and the only one that can make
       the head *translate*. Rotating it alone moves the head on an arc, which
       is why a neck driven by rotation only still reads as a stick: the head
       pivots instead of drifting. */
    neckR: new Spring(1.05, 0.6),
    neckX: new Spring(0.82, 0.5),
    neckY: new Spring(1.3, 1.0),
    headR: new Spring(1.15, 0.62),
    headX: new Spring(1.0, 0.7),
    headY: new Spring(1.2, 0.9),
    headTurn: new Spring(0.45, 0.9),
    /* Hair follows the head's *world* angle with a lag, so the local offset is
       zero at rest and only appears while the head is moving. The fringe is
       short and stiff; the back hair is long, soft and under-damped. */
    hairFWorld: new Spring(1.7, 0.55),
    hairBWorld: new Spring(0.95, 0.3),
    armRR: new Spring(0.9, 0.75),
    armLR: new Spring(0.9, 0.75),
    legRR: new Spring(1.2, 1.0),
    legLR: new Spring(1.2, 1.0),
    /* Softer and slower than the thigh: a knee that snaps back at the same rate
       as the hip reads as a hinge, not as a joint under load. */
    kneeRR: new Spring(0.95, 0.72),
    kneeLR: new Spring(0.95, 0.72),
    elbowRR: new Spring(1.1, 0.68),
    elbowLR: new Spring(1.1, 0.68),
    /* The hand is the lightest thing on the chain, so it is the fastest and the
       least damped — it should still be settling after the forearm has stopped.
       It was 1.45 Hz / ζ 0.5, which settles in ~0.6 s: technically "alive", but
       on a hand that only travels 1.5° the settle is over before the eye gets
       there, so the hand looked pinned. 1.05 Hz / ζ 0.42 is slow enough that
       the follow-through is visible and the overshoot is ~25% rather than 15%.
       Same idea for the boot, one step slower: a boot has mass. */
    wristRR: new Spring(1.05, 0.42),
    wristLR: new Spring(1.05, 0.42),
    ankleRR: new Spring(1.05, 0.78),
    ankleLR: new Spring(1.05, 0.78),
    monY: new Spring(0.42, 0.55),
    monR: new Spring(0.3, 0.6),
    /* The device's own swing on its mount, separate from her body.
       It has to be its own spring: `monWorld` chases `hipsR`, so an impulse
       there is subtracted again by her hips moving the same way and the net
       rock on screen is a fraction of what the call site asked for. This one
       targets zero, so an impulse is entirely the device's own motion — and
       under-damped, because a 1150-unit housing on a cradle does not settle in
       one arc. */
    monHit: new Spring(1.1, 0.42),
    /* The device is a heavy object loosely socketed at her waist, so its world
       angle is a *lagged* version of her torso's and its local angle is the
       difference. This is the same spring-bone formulation as the hair, and for
       the same reason: two things driven off one shared target can only differ
       in lag, never drift apart. Driving the device with its own sine — which is
       what the first version did — made it look painted onto the background
       instead of hanging off her.
       `monAim` is the turret term: the bore leans toward wherever she is
       looking, which is the one cue that reads as "she is aiming it". */
    monWorld: new Spring(0.55, 0.5),
    monAim: new Spring(0.7, 0.72),
    /* The recoil is a spring rather than a CSS keyframe: the device is placed
       with a composed matrix, and a CSS transform on it would fight that. */
    monRecoil: new Spring(2.2, 0.5),
    /* Face. Stiffer than the body — a brow that eases in like a shoulder
       reads as rubber.
       The mouth starts at 1, not 0: 1 is its resting scale ("as drawn"), and a
       spring that begins at 0 applies `scaleY(0)` on the first frame after
       hydration, so the mouth visibly vanishes for ~60ms and then inflates.
       Every other spring here rests at 0, which is a valid neutral for a
       position — for a scale it is a hole in her face.
       `mouthOpen` is stiff enough to track the 34ms glyph steps of a spoken
       line. At the softer 3.0 it averaged them instead, and the whole line came
       out as one gentle wobble around 1.4 whatever vowel was on screen. */
    browY: new Spring(2.6, 0.78),
    browTilt: new Spring(2.4, 0.8),
    mouthOpen: new Spring(4.6, 0.82, 1),
    mouthWide: new Spring(5.2, 0.9, 1),
  };

  private readonly opts: Required<Pick<LaciaRigOptions, 'base' | 'uid' | 'autoForms'>> & LaciaRigOptions;

  constructor(host: HTMLElement, opts: LaciaRigOptions = {}) {
    const skin = LACIA_SKINS[opts.skin ?? 'suit'];
    this.pivot = pivotTable(skin);
    this.limbs = armChain(skin);
    this.opts = { base: skin.base, uid: 'lacia-mono', autoForms: false, ...opts };
    this.energy = opts.energy ?? 1;
    this.reduced = opts.reduced ?? false;

    const mounted = skinComponents(opts.skin ?? 'suit', opts.components);
    this.actions = [...SELF_ACTIONS, ...actionList(mounted)];

    host.classList.add('lr');
    if (!host.querySelector('.lr-stage')) {
      host.innerHTML = laciaMarkup({ base: this.opts.base, uid: this.opts.uid, skin: opts.skin, components: opts.components });
    }
    this.el = host;

    host.querySelectorAll<HTMLElement>('[data-bone]').forEach((el) => {
      const bone = el.dataset.bone as LaciaBone;
      this.bones.set(bone, el);
      const p = this.pivot[bone];
      // The back hair gets a composed matrix instead of a pivot rotation.
      if (bone === 'hairBack') el.style.transformOrigin = '0px 0px';
      else if (p) el.style.transformOrigin = `${p[0]}px ${p[1]}px`;
    });

    // Eyes are identified by file name — the part id is the file stem.
    host.querySelectorAll<HTMLImageElement>('img.lr-part').forEach((img) => {
      const name = decodeURIComponent(img.getAttribute('src') ?? '').split('/').pop() ?? '';
      const stem = name.replace(/\.webp$/, '');
      if (EYE.has(stem)) this.eyes.push(img);
      if (stem.startsWith('irides')) this.irises.push(img);
    });

    /* The face stack: every variant is present in the DOM, `data-on` picks one.
       Swapping `src` instead would flash an unloaded file on first use. */
    host.querySelectorAll<HTMLImageElement>('img.lr-face').forEach((img) => {
      const group = img.dataset.face ?? '';
      const v = img.dataset.v ?? 'neutral';
      if (group === 'mouth') {
        this.mouths.set(v as MouthVariant, img);
        /* Part from the top lip, not the middle of the padded box: the chin is
           what drops. FACE_PAD is the transparent margin above the mouth. */
        img.style.transformOrigin = `50% ${FACE_PAD}px`;
      } else {
        const list = this.brows.get(group) ?? [];
        list.push(img);
        this.brows.set(group, list);
      }
    });

    /* Component elements, grouped by `data-comp`. A component may own several
       parts (the device has its own SVG plus a mount on her waist), so they are
       toggled together — that is what makes "hide the waist slot" a single
       decision rather than one per element. */
    for (const def of mounted) {
      const els = Array.from(host.querySelectorAll(`[data-comp="${def.id}"]`));
      if (els.length) this.comps.push({ def, els, on: true });
    }

    this.monolith = host.querySelector<SVGElement>('.lr-monolith');
    this.lock = host.querySelector<SVGElement>('.lr-device-lock');
    if (this.monolith) this.monolith.dataset.form = this.form;
    this.el.dataset.form = this.form;

    this.onPointer = this.onPointer.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onDeviceClick = this.onDeviceClick.bind(this);
    this.tick = this.tick.bind(this);

    // Clicking the device is the in-fiction unlock, so it is also the control:
    // it stops the event so the surrounding mascot button does not also talk.
    this.monolith?.addEventListener('click', this.onDeviceClick);

    addEventListener('pointermove', this.onPointer, { passive: true });
    addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /* ── public api ─────────────────────────────────────────────────────── */

  get currentForm() {
    return this.form;
  }

  start() {
    // Reduced motion: the markup already sits in its neutral pose, so there is
    // nothing to drive — just leave the figure standing.
    if (this.reduced) return;
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.t0 = this.last;
    this.autoAt = this.last + 9000;
    this.blinkAt = this.last + 2600;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.endAction();
    this.monolith?.removeEventListener('click', this.onDeviceClick);
    removeEventListener('pointermove', this.onPointer);
    removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** React to the site's mascot state machine. */
  setState(s: LaciaState) {
    if (s === this.state) return;
    const prev = this.state;
    this.state = s;
    this.energy = (this.opts.energy ?? 1) * ENERGY[s];
    if (s === 'talk' && prev !== 'talk') this.S.headR.kick(-8);
    if (s === 'happy') this.S.rootY.kick(-26);
  }

  /**
   * Type a line out and move the mouth with it.
   *
   * The caller passes the same `delay` / `speed` it gives the typewriter, so the
   * mouth is driven by the glyph that is appearing — see viseme.ts for why that
   * is the honest ceiling without audio. The rig owns the end of the line, so a
   * host that calls this never has to keep a timer in sync with the CSS.
   */
  say(lines: readonly SayLine[]) {
    const cues = buildScript(lines);
    this.script = cues;
    this.scriptStart = performance.now();
    this.scriptIdx = 0;
    const last = cues.length ? cues[cues.length - 1].at : 0;
    // Hold the final shape briefly, then release — a mouth that snaps shut on
    // the last glyph looks like the audio was cut.
    this.scriptEnd = this.scriptStart + last + 240;
    this.setState('talk');
  }

  /* ── actions ────────────────────────────────────────────────────────── */

  /** Every action currently available — her own modules plus each component's. */
  get actionIds(): readonly string[] {
    return this.actions.map((a) => a.id);
  }

  get runningAction(): string | null {
    return this.activeAction?.id ?? null;
  }

  /**
   * Derive the action × component table for this figure.
   *
   * Never authored, never stored: it is computed from the sparse rules on each
   * action and each component, which is why it cannot drift from them. The
   * settings panel reads it; `verify/components.mjs` asserts against it.
   */
  visibility(): VisibilityMatrix {
    return visibilityMatrix(this.comps.map((c) => c.def));
  }

  /**
   * Play one action. Only one runs at a time — starting one ends whatever was
   * playing, which is what "no two motion modules at once" means in practice.
   *
   * Returns false if the id is not available on this figure, which is the
   * normal case for a device action on an outfit that mounts no device.
   */
  runAction(id: string, manual = true): boolean {
    const action = this.actions.find((a) => a.id === id);
    if (!action) return false;
    this.endAction();
    this.activeAction = action;
    this.actionManual = manual;
    this.el.dataset.action = action.id;
    this.applyVisibility(action);
    action.onStart?.(this);
    if (action.duration && action.duration > 0) {
      this.actionTimer = window.setTimeout(() => this.endAction(), action.duration);
    }
    return true;
  }

  /** Stop the running action and put every component back on screen. */
  endAction() {
    const prev = this.activeAction;
    if (!prev) return;
    this.activeAction = null;
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = 0;
    }
    /* Delayed callbacks belong to the action that scheduled them. Without this
       a 260 ms head snap from `railgun` would still fire after the player had
       already started something else, and the rig would twitch for no reason. */
    for (const t of this.actionPending) clearTimeout(t);
    this.actionPending = [];
    this.applyVisibility(null);
    delete this.el.dataset.action;
    prev.onEnd?.(this);
  }

  /**
   * Resolve visibility for every mounted component.
   *
   * Called on action start and end only — never per frame. That is the whole
   * performance story: the table is small, it is read twice per action, and the
   * hidden subtree is `visibility:hidden` so the compositor stops drawing it
   * while the DOM stays put (re-showing costs no decode, no layout).
   */
  private applyVisibility(action: MascotAction<RigHandle> | null) {
    for (const c of this.comps) {
      const on = action ? actionVisible(action, c.def) : true;
      if (on === c.on) continue;
      c.on = on;
      for (const el of c.els) (el as HTMLElement).dataset.on = on ? '1' : '0';
    }
  }

  /* ── RigHandle: the surface an action module is allowed to touch ────── */

  impulse(spring: LaciaSpring, peak: number) {
    this.S[spring].impulse(peak);
  }

  kick(spring: LaciaSpring, velocity: number) {
    this.S[spring].kick(velocity);
  }

  /** Apply a device configuration. Separate from `setForm` so that an action
   *  can set the hardware without re-entering the action that describes it. */
  setDeviceForm(form: LaciaForm) {
    this.form = form;
    if (this.monolith) this.monolith.dataset.form = form;
    // The host carries the form too: the barrier has to paint in front of her,
    // which is a stacking decision the stylesheet makes from this attribute.
    this.el.dataset.form = form;
    this.lock?.classList.toggle('is-unlocked', form !== 'coffin');
    this.opts.onForm?.(form, this.actionManual);
  }

  after(ms: number, fn: () => void) {
    const t = window.setTimeout(() => {
      this.actionPending = this.actionPending.filter((x) => x !== t);
      fn();
    }, ms);
    this.actionPending.push(t);
  }

  /* ── legacy entry points ─────────────────────────────────────────────── */

  /** One-off reaction to a click. Registered as her own module `self:poke`. */
  poke() {
    this.runAction('self:poke', true);
  }

  /**
   * Switch the device configuration by playing the action that gets it there.
   *
   * Kept as the public entry point because every host and every verifier uses
   * it, but it is no longer where the motion lives: the reaction belongs to the
   * action, so a component can describe its own body language instead of the
   * engine hard-coding four branches.
   */
  setForm(form: LaciaForm, manual = true) {
    if (form === this.form) return;
    this.runAction(`monolith:${form}`, manual);
  }

  nextForm(manual = true) {
    const i = LACIA_FORM_ORDER.indexOf(this.form);
    this.setForm(LACIA_FORM_ORDER[(i + 1) % LACIA_FORM_ORDER.length], manual);
  }

  setEnergy(n: number) {
    this.opts.energy = n;
    this.energy = n * ENERGY[this.state];
  }

  setAutoForms(on: boolean) {
    this.opts.autoForms = on;
  }

  private onDeviceClick(e: Event) {
    e.stopPropagation();
    this.nextForm(true);
  }

  /* ── input ──────────────────────────────────────────────────────────── */

  private onPointer(e: PointerEvent) {
    const now = performance.now();
    if (now - this.rectAt > 500) {
      this.rectAt = now;
      const r = this.el.getBoundingClientRect();
      this.rect = { x: r.left, y: r.top, w: r.width || 1, h: r.height || 1 };
    }
    const cx = this.rect.x + this.rect.w * 0.4;
    const cy = this.rect.y + this.rect.h * 0.3;
    // A fixed 420px attention radius reads the same whether she is a 300px
    // corner mascot or a 900px stage figure.
    this.pointer.x = Math.max(-1, Math.min(1, (e.clientX - cx) / 420));
    this.pointer.y = Math.max(-1, Math.min(1, (e.clientY - cy) / 420));
  }

  private onResize() {
    this.rectAt = 0;
  }

  private onVisibility() {
    if (document.hidden) this.stop();
    else if (!this.reduced) this.start();
  }

  /* ── frame ──────────────────────────────────────────────────────────── */

  private tick(now: number) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const raw = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.acc = Math.min(this.acc + raw, 0.1);

    const ease = Math.min(1, raw * 3.4);
    this.pointer.sx += (this.pointer.x - this.pointer.sx) * ease;
    this.pointer.sy += (this.pointer.y - this.pointer.sy) * ease;

    if (now > this.turnAt) {
      this.turnAt = now + 4800 + Math.random() * 6200;
      this.turnTarget = (Math.random() - 0.5) * 9;
    }
    if (this.opts.autoForms && this.state === 'idle') this.autoForm(now);

    const t = (now - this.t0) / 1000;
    const TAU = Math.PI * 2;
    const breath = Math.sin(t * TAU * 0.27);
    const sway = Math.sin(t * TAU * 0.083);
    const micro = Math.sin(t * TAU * 0.31 + 1.1);
    const look = this.pointer.sx;
    const e = this.energy;
    /* Declared up here rather than at the weight-transfer block below, because
       three separate chains now read it (bust drift, neck drift, legs) and a
       block-scoped `const` halfway down the loop is a trap. Its period (24 s) is
       deliberately not a multiple of `sway`'s (12 s), so the combination takes a
       couple of minutes to repeat. */
    const weight = Math.sin(t * TAU * 0.041 + 0.9);

    const FIXED = 1 / 120;
    const P = FORM_POSE[this.form];
    let n = 0;
    while (this.acc >= FIXED && n++ < 24) {
      this.acc -= FIXED;
      const S = this.S;
      S.rootY.step(breath * 0.7 * e + P.rootY, FIXED);
      S.hipsX.step(sway * IDLE * 2.3 * e + P.hipsX, FIXED);
      S.hipsR.step(sway * IDLE * 0.42 * e, FIXED);
      /* `spineR` is stepped *below*, after `monAim`, because the device's
         reaction feeds into it. */
      S.chestR.step((breath * 1.5 + micro * 0.45 + sway * IDLE * 0.5) * e + P.chest, FIXED);
      S.torsoY.step(1 + breath * 0.018 * e, FIXED);
      S.torsoX.step(1 - breath * 0.007 * e, FIXED);
      /* ── bust ───────────────────────────────────────────────────────────
       *
       * `torso` carries the topwear layer, so this is the one bone that can
       * make the chest move on its own instead of moving with the ribcage.
       *
       * Two things are being modelled, and they are not the same:
       *
       * 1. **Rotation follows the chest, late and partially.** `+0.35 ×
       *    (chest − pose)` — positive, not negative. A soft mass hanging off
       *    the ribcage rotates *less* than the ribcage and *after* it; because
       *    this spring is much softer than the chest's (1.15 Hz / ζ 0.52
       *    against 0.95 Hz / ζ 0.66) the lag comes out of the spring, not out
       *    of a hand-written phase. Writing `−chest × k` was the first
       *    attempt: it makes the bust rotate *against* the ribcage, which on
       *    a front view reads as the chest tilting the wrong way.
       * 2. **Lateral drift lags the hips.** `torsoShift` targets `weight`, not
       *    `hipsX`, so it keeps drifting after the pelvis has stopped — and
       *    the `−hipsX × 0.35` term makes the ribcage counter the pelvis
       *    instead of riding on it, which is what standing on one hip does.
       *
       * Amplitudes stay in the 1–2 px / 1–2° range. This is a standing figure
       * breathing, not a walk cycle; the point is that the surface is never
       * exactly still, not that anything visibly swings. */
      S.torsoR.step(
        (S.chestR.x - P.chest) * 0.35 +
          (0.6 * Math.sin(t * TAU * 0.19 + 2.3) + 0.3 * Math.sin(t * TAU * 0.063 + 1.1)) * e,
        FIXED,
      );
      /* Only the *dynamic* part of the pelvis is fed back. `hipsX` carries the
         form's own offset (railgun leans 6 px), and a pose is not a reaction —
         feeding the raw value would tilt the bust permanently by 2 px in that
         form only. Same reason `monAim` refuses `headR`. */
      S.torsoShift.step(weight * IDLE * 1.6 * e - (S.hipsX.x - P.hipsX) * 0.35, FIXED);
      /* ── neck ───────────────────────────────────────────────────────────
       *
       * This used to be `look × 1.1 + micro × 0.22` — i.e. the neck only moved
       * when the pointer did, and by a fifth of a degree otherwise. That is
       * exactly "脖子僵硬": between the shoulders and the head there was a
       * rigid column, so the head looked mounted rather than carried.
       *
       * A living neck never stops: it carries the head's weight, so it holds a
       * slow drift of its own (0.9° on the breath, 0.55° on the sway) and a
       * faster micro-tremor. `neckX` is what makes that read — pure rotation
       * pivots the head on an arc, which still looks like a stick; a lateral
       * offset makes the head *float* over the shoulders. */
      S.neckR.step((look * 1.1 + micro * 0.5 + breath * 0.9 + sway * IDLE * 0.55) * e, FIXED);
      S.neckX.step(weight * IDLE * 1.5 * e - (S.chestR.x - P.chest) * 0.18, FIXED);
      S.neckY.step((-breath * 2.4 + weight * 1.2) * e, FIXED);
      S.headTurn.step(this.turnTarget * e, FIXED);
      /* ── head stabilisation ─────────────────────────────────────────────
       *
       * A head is not a flag on a pole. Standing still, the body sways a few
       * degrees and the head very nearly does not: the neck cancels most of
       * what the hips, spine and chest hand up, because the vestibular system
       * is trying to hold the eyes level. Before this term the head was driven
       * by `sway` on its own, so it swung *with* the torso and the whole figure
       * read as one rigid stick pivoting at the ankle.
       *
       * The compensation is taken from the *current* spring values, not from
       * the targets, so it cannot run ahead of the body it is correcting. 0.68
       * rather than 1.0 on purpose: a fully stabilised head looks like a
       * chicken and stops belonging to the body. It went up from 0.55 when the
       * chest and neck amplitudes were raised — with more torso motion to
       * cancel, 0.55 let the head ride along and the neck stopped reading as
       * soft. The visible result is *more* neck motion and *less* head motion,
       * which is the right way round. */
      const torsoWorld = S.hipsR.x + S.spineR.x + S.chestR.x + S.neckR.x;
      S.headR.step(
        (sway * IDLE * 0.42 + micro * 0.42 + look * 2.9 + S.headTurn.x) * e + P.head - torsoWorld * 0.68,
        FIXED,
      );
      S.headX.step(look * 1.9 * e, FIXED);
      S.headY.step(-breath * 1.1 * e, FIXED);
      /* Both hair layers chase the same quantity — the head's world angle —
         with different stiffness. The local rotation is the difference, so it
         is zero at rest and can never point the opposite way to the head.
         (Driving them with independent sine terms was what made the fringe and
         the back hair drift apart.) */
      const phi = S.hipsR.x + S.spineR.x + S.chestR.x + S.neckR.x + S.headR.x;
      S.hairFWorld.step(phi, FIXED);
      S.hairBWorld.step(phi, FIXED);
      /* ── weight transfer ────────────────────────────────────────────────
       *
       * `weight` is the single most important term in this function. A standing
       * person is never symmetric: the centre of mass drifts from one foot to
       * the other over roughly ten seconds, the loaded leg straightens and the
       * free one softens. Both legs used to be driven by the same `sway`
       * expression — literally identical numbers — so the lower body moved as
       * one board, and no amount of extra amplitude on the knees could fix
       * that, because the two legs had no reason to disagree.
       *
       * `weight` is +1 when her weight is on the left foot, −1 on the right.
       * (Its declaration sits with the other oscillators at the top of the
       * loop, because the bust and the neck read it too.) */
      const loadR = 0.5 - weight * 0.5; // 1 = right leg carries her
      const loadL = 1 - loadR;

      /* ── arms hang ──────────────────────────────────────────────────────
       *
       * The upper arm's target carries `−torsoWorld × 0.45`. That is not a
       * stylistic choice: an arm hanging from a moving shoulder stays put in
       * space, so *relative to the torso* it swings the other way. Driving it
       * with its own sine (which is what this did) makes it move with the
       * body, and an arm that moves with the body reads as a mannequin with a
       * welded shoulder.
       *
       * The two sides take the same torso term with opposite signs, because the
       * weight shift is what makes one arm hang closer to the hip than the
       * other. */
      /* ── the planted hand ───────────────────────────────────────────────
       *
       * Two of the four forms are not "she stands next to the device", they are
       * "she is leaning on it" — the official figure has her palm flat on the
       * casket's edge with her hip cocked into it. Reaching that with fixed
       * angles was the earlier attempt and it is wrong in a way that is easy to
       * miss: the arm is correct at rest, but the shoulder it hangs from moves
       * with the chest, so the palm slides a few pixels on every breath. The eye
       * reads that slide as "not touching", no matter how close the numbers are.
       *
       * So the arm is solved instead of posed. The rail is bolted to the pelvis,
       * so the target is a point in the **hips' frame** pushed through
       * `worldHips`; the chest can breathe all it likes and the palm stays on
       * the rail because the shoulder-to-palm distance is re-solved each frame.
       * The spring is kept on top of the solution — a hand that tracks its
       * contact with zero lag reads as welded, not as resting. */
      const plant = HAND_PLANT[this.form];
      let armLTarget = (-micro * 0.55 - weight * IDLE * 0.55) * e + P.armL - torsoWorld * 0.45;
      let elbowLTarget = -S.armLR.x * 0.35 + (1.1 + 0.8 * Math.sin(t * TAU * 0.059 + 2.4)) * e + P.elbowL;
      if (plant && plant.side === 'l') {
        /* Three transforms, and the last two are the ones that make it read.
         *
         * 1. **The device's own matrix.** The rail is not a point in the hips'
         *    frame — it is a point on a thing that rolls, aims and takes recoil
         *    impulses. Reading the same matrix `pose` writes means the hand
         *    rides the rail through all of it, including the jolt when the rails
         *    throw.
         * 2. **Into the chest frame.** The arm hangs off the chest, not the
         *    hips, so its shoulder travels with the ribcage. Solving against the
         *    rest shoulder while the real shoulder has moved 3 px puts the palm
         *    3 px off the rail — and since the chest is what breathes, that
         *    error oscillates with the breath. That slide is the single clearest
         *    tell that two objects are on independent clocks. Measured at 16 px
         *    before this correction. */
        const wHips = matMul(matMove(0, S.rootY.x), matAbout(matMul(matMove(S.hipsX.x, 0), matRot(S.hipsR.x)), 246, 700));
        const wSpine = matMul(wHips, matAbout(matRot(S.spineR.x), 246, 700));
        const wChest = matMul(wSpine, matAbout(matRot(S.chestR.x), 246, 660));
        const mon = plant.frame === 'device' ? this.monMatrix() : null;
        const [wx, wy] = matPt(mon ?? wHips, plant.at[0], plant.at[1]);
        const [tx, ty] = matPt(matInv(wChest), wx, wy);
        const sol = armIk(this.limbs, 'l', tx, ty);
        armLTarget = sol.arm;
        elbowLTarget = sol.elbow;
      }

      S.armRR.step((micro * 0.55 + weight * IDLE * 0.55) * e + P.armR - torsoWorld * 0.45, FIXED);
      S.armLR.step(armLTarget, FIXED);
      /* Elbows carry the arm's swing a little late and a little less, so the
         forearm trails the upper arm instead of moving as one rod. The slow
         independent term is what keeps the arms from looking pinned — an arm
         held at exactly one angle reads as a mannequin even when the shoulder
         is moving. */
      S.elbowRR.step(-S.armRR.x * 0.35 + (1.1 + 0.8 * Math.sin(t * TAU * 0.071 + 0.6)) * e + P.elbowR, FIXED);
      S.elbowLR.step(elbowLTarget, FIXED);
      /* ── wrists ─────────────────────────────────────────────────────────
       *
       * A hand is not welded to a forearm. It hangs: it lags the forearm,
       * overshoots it, and settles after it. Two things make that read:
       *
       * 1. The *negative* coupling. `wrist = −elbow × 0.28` means the hand
       *    counter-rotates a little against the forearm, which is what a wrist
       *    does under its own weight when the arm swings. Driving it with
       *    `+elbow × k` makes the hand swing *past* the forearm, which looks
       *    like a flag on a pole.
       * 2. Its own slow term, on a period that matches neither the arm nor the
       *    leg. Hands are where stillness is most visible: a hand that holds
       *    exactly one angle is the clearest tell that a figure is a puppet.
       *
       * In `railgun` the near hand is gripping the rail, so it also has to
       * follow the device — see `grip` below. A hand that stays put while the
       * rail it is holding rotates is the thing that reads as "no linkage". */
      const grip = this.form === 'railgun' ? 1 : 0;
      /* Two incommensurate sines per hand, ~2° total travel. One sine at this
         amplitude reads as a mechanism: the hand reaches its limit, reverses,
         reaches it again, forever. The second term is what makes the envelope
         wander. */
      S.wristRR.step(
        -S.elbowRR.x * 0.34 +
          (1.5 + 1.25 * Math.sin(t * TAU * 0.093 + 1.9) + 0.6 * Math.sin(t * TAU * 0.147 + 0.4)) * e +
          P.wristR,
        FIXED,
      );
      S.wristLR.step(
        /* A *relaxed* hand hangs; it does not stay square to the forearm. So the
           hand's own angle is driven by the forearm's angle in the world, not by
           the elbow joint alone — `−(arm + elbow)`, not `−elbow`. At rest the two
           are the same thing (arm is 0), which is why this only showed up in the
           posed forms: with the forearm swung out to the rail, keeping the wrist
           square to it made the hand point at the device instead of lying on it. */
        (plant ? -(S.armLR.x + S.elbowLR.x) * 0.55 : -S.elbowLR.x * 0.34) +
          (1.5 + 1.25 * Math.sin(t * TAU * 0.077 + 4.1) + 0.6 * Math.sin(t * TAU * 0.131 + 2.8)) * e +
          (plant ? plant.wrist : P.wristL) +
          /* A planted hand follows the *pelvis*, not the bore. The rail is
             bolted to her waist, so letting the aim spring drag her wrist
             around would slide the palm along the rail every time she looked
             somewhere. */
          (plant ? 0 : S.monAim.x * 0.55 * grip),
        FIXED,
      );
      /* ── hips and legs ──────────────────────────────────────────────────
       *
       * The thigh term is the *sum* of two things: the whole-body sway (both
       * legs lean the same way, which is what a body does when it leans) and
       * the weight transfer (the legs lean opposite ways, which is what a body
       * does when it shifts from one foot to the other). Keeping them separate
       * is why this reads as standing rather than as swaying. */
      S.legRR.step((sway * IDLE * 1.15 + weight * IDLE * 0.85) * e + P.legR, FIXED);
      S.legLR.step((sway * IDLE * 1.15 - weight * IDLE * 0.85) * e + P.legL, FIXED);
      /* Knees do two jobs, and neither one is a sagittal bend.
       *
       *  This art is a **front view**, so a real knee bend (heel toward the hip)
       *  is almost invisible — the leg only foreshortens. What reads from the
       *  front is the shin angling against the thigh, so the knee term is a
       *  counter-rotation: the thigh swings on the hip and the shin stays
       *  roughly vertical, which is also what stops the foot skating sideways.
       *
       *  The second job is de-synchronising the legs. Before this both legs were
       *  driven by the same `sway` expression, so they moved as one rigid piece
       *  — which is the actual source of "the knee is stiff", not the amplitude.
       *  A standing person never loads both legs identically; the two knees here
       *  breathe on different periods.
       *
       *  Range: ~0.5–5° at rest, 9° dangling. Measured that the thigh/shin crops
       *  stay seamless to 26°, so there is plenty of headroom above this.
       *
       *  Two incommensurate sines per leg, with *different frequencies on each
       *  side*. A phase offset on one shared sine is not enough: the two legs
       *  then beat against each other and one of them sits almost still for
       *  seconds at a time, which is its own kind of stiff. */
      const kneeSoft = this.state === 'held' ? 9 : this.state === 'sleep' ? 3 : 2.4;
      /* A loaded leg straightens and an unloaded one softens. This is the third
         cue that the two legs are not the same object: the thigh angles already
         disagree, and now their knees do too, in the opposite direction. The
         factor is a *range* (0.55× to 1.45×), not an offset, so `held` and
         `sleep` keep their much larger soft values.

         Only the **dynamic** part of the thigh is countered. Feeding the raw
         `legRR.x` here (which is what this did before the forms had legs) meant
         every stance angle was immediately cancelled by 85%: the thigh swung
         out to plant the foot wide and the knee swung it straight back, so a
         pose with `legR: 4.6` produced a 0.7° stance and the legs never actually
         moved. Same mistake as feeding a pose constant into `monAim`. */
      S.kneeRR.step(
        P.shinR - P.legR -
          (S.legRR.x - P.legR) * 0.85 +
          (kneeSoft * (1.45 - 0.9 * loadR) + IDLE * (1.5 * Math.sin(t * TAU * 0.107) + 0.8 * Math.sin(t * TAU * 0.043 + 1.3))) * e,
        FIXED,
      );
      S.kneeLR.step(
        P.shinL - P.legL -
          (S.legLR.x - P.legL) * 0.85 +
          (kneeSoft * (1.45 - 0.9 * loadL) + IDLE * (1.5 * Math.sin(t * TAU * 0.089 + 2.1) + 0.8 * Math.sin(t * TAU * 0.051 + 0.4))) * e,
        FIXED,
      );
      /* ── ankles ─────────────────────────────────────────────────────────
       *
       * This is the joint that keeps her feet on the ground. Because the shin is
       * driven by a counter-rotation, the boot inherits that swing — and a boot
       * that tilts with the shin is the single clearest sign that a rig has no
       * ankle at all: she reads as standing on two stilts hinged at the knee.
       *
       * The boot's angle in the world is `thigh + shin + ankle` (all three are
       * nested), so *that* is the quantity that has to stay near zero, not the
       * ankle alone. `P.ankle` is derived from the pose above as
       * `−(leg + knee)` for exactly this reason: a stance angle that is not
       * cancelled here tilts the sole by the full stance angle, which is how a
       * wide stance turns into standing on two slanted blocks.
       *
       * Cancelling ~80% of the shin's *dynamic* angle keeps the sole level; the
       * leftover 20% is what gives the ankle something to do. As with the knee,
       * this is a front view, so a real dorsiflexion (toes up) would be
       * invisible — what reads from the front is the *sole's* angle, which is
       * exactly what this term controls.
       *
       * The independent terms run on different periods per side, and the loaded
       * foot is the stiller one: it is the one carrying her. */
      S.ankleRR.step(
        -P.shinR -
          (S.kneeRR.x - (P.shinR - P.legR)) * 0.8 +
          (0.7 + 0.55 * Math.sin(t * TAU * 0.13 + 2.2)) * (1.3 - 0.6 * loadR) * IDLE * e,
        FIXED,
      );
      S.ankleLR.step(
        -P.shinL -
          (S.kneeLR.x - (P.shinL - P.legL)) * 0.8 +
          (0.7 + 0.55 * Math.sin(t * TAU * 0.111 + 0.5)) * (1.3 - 0.6 * loadL) * IDLE * e,
        FIXED,
      );
      S.monY.step(Math.sin((t * TAU) / 6.4) * 3.4 - S.rootY.x * 0.12, FIXED);
      S.monR.step(Math.sin((t * TAU) / 8.4 + 0.7) * 0.8 * Math.min(1, e), FIXED);
      /* The device trails her hips — not her chest. Coupling it to `chestR` was
         the first attempt and it is wrong twice over: the device is socketed at
         her waist, so a chest twist does not carry it, and because the thing is
         1150 units tall a permanent 8° offset swings its tip 160 units and reads
         as "it is falling over" rather than as attachment. A socket inherits its
         parent, full stop; the only thing left to model is lag.
         The aim term is where the *visible* linkage lives: she turns her head,
         the bore turns with her, more of it in `railgun` because that is the
         form where a barrel pointed at the wrong thing is a mistake. */
      S.monWorld.step(S.hipsR.x, FIXED);
      /* The socket is not a one-way street. A 1150-unit mass pivoting at her
         waist pulls on her; without this term she moves the device and is never
         moved by it, which is exactly what reads as "two objects animated by
         the same clock". Velocity, not displacement: feeding the *position*
         back closes a loop through chest → neck → head → `monAim` and sets up a
         slow oscillation. The velocity term is pure damping and cannot do that.
         `S.monAim.v` is in degrees/second and the aim spring is soft, so the
         coefficient stays small. */
      S.spineR.step(
        (-sway * IDLE * 0.85 + weight * IDLE * 0.5 + breath * 0.6 + look * 0.45) * e + P.spine - S.monAim.v * 0.045,
        FIXED,
      );
      /* Only the *dynamic* part of her head goes into the aim: the idle
         look-around (`headTurn`) and the pointer. Feeding it `headR` instead
         looked right in the code and wrong on screen, because `headR` also
         carries the form's own pose offset — a railgun stance with her head
         rolled 4° tilted the whole device 4.4° permanently, which on a
         1150-unit object is a 158-unit lean. A pose is not a reaction. */
      S.monAim.step((S.headTurn.x * 0.45 + look * 2.4) * (this.form === 'railgun' ? 1.35 : 1) * Math.min(1, e), FIXED);
      S.monHit.step(0, FIXED);
      S.monRecoil.step(0, FIXED);
      /* Face. State and form are combined here rather than in a lookup table,
         because they compose differently: brow offset is additive, mouth
         shape is multiplicative (both are "×1 = as drawn" scales). */
      const ES = EXPR_STATE[this.state];
      const EF = EXPR_FORM[this.form];
      /* Mouth: the glyph being typed decides how far it is open (viseme.ts).
         Two fallbacks matter. A host that only flips `setState('talk')` — the
         corner mascot, whose bubble timing lives in Mascot.astro — gets the old
         syllable-rate pulse, because it never gave us a schedule. And once the
         last glyph has landed the script clears itself, so the mouth closes
         instead of freezing half open. */
      let vo = 0;
      let vw = 1;
      if (this.script.length) {
        const el = now - this.scriptStart;
        while (this.scriptIdx + 1 < this.script.length && this.script[this.scriptIdx + 1].at <= el) {
          this.scriptIdx++;
        }
        const cue = this.script[this.scriptIdx];
        if (el >= cue.at) {
          vo = cue.open;
          vw = cue.wide;
        }
        if (now > this.scriptEnd) {
          this.script = [];
          this.scriptIdx = 0;
          if (this.state === 'talk') this.setState('idle');
        }
      } else if (this.state === 'talk') {
        vo = 0.3 * (0.5 + 0.5 * Math.sin(t * TAU * 4.1));
      }
      S.browY.step(ES.browY + EF.browY, FIXED);
      S.browTilt.step(ES.tilt + EF.tilt, FIXED);
      S.mouthOpen.step(ES.open * EF.open + vo * 0.85, FIXED);
      S.mouthWide.step(ES.wide * EF.wide * vw, FIXED);

      /* Pick the shape. Composition, not precedence: an *emotion* owns both
         features; a device form owns them only while she is otherwise neutral;
         and `talk` only parts the mouth, because narrating a form change is not
         a feeling. (Before this, `talk` won outright, so every manual form
         switch — which also shows a line — left the form's own expression
         unused and she looked identical in all four.) */
      const emotional = this.state === 'happy' || this.state === 'held' || this.state === 'sleep';
      const fm = FORM_FACE[this.form];
      const st = STATE_FACE[this.state];
      const brow = emotional ? st.brow : fm.brow;
      const mouth =
        this.state === 'talk' ? ('open' as MouthVariant) : emotional ? st.mouth : fm.mouth;

      if (brow !== this.browVariant) {
        this.browVariant = brow;
        for (const imgs of this.brows.values())
          for (const img of imgs) img.toggleAttribute('data-on', img.dataset.v === brow);
      }
      if (mouth !== this.mouthVariant) {
        this.mouthVariant = mouth;
        for (const [v, img] of this.mouths) img.toggleAttribute('data-on', v === mouth);
      }

      /* Blush is a gradient on the cheek, not a layer — see face.ts. Toggled on
         the host so the stylesheet owns the fade. */
      const flush = BLUSH_STATES.has(this.state);
      if (flush !== this.blush) {
        this.blush = flush;
        this.el.toggleAttribute('data-blush', flush);
      }
    }

    this.pose();
    this.tickEyes(now);
  }

  /**
   * World matrices for the body chain, from the current spring state.
   * Anything that paints outside `.lr-bones` — the back hair, the device —
   * needs these, because it cannot inherit the chain through the DOM.
   */
  private chain() {
    const S = this.S;
    const worldHips = matMul(matMove(0, S.rootY.x), matAbout(matMul(matMove(S.hipsX.x, 0), matRot(S.hipsR.x)), 246, 700));
    const worldSpine = matMul(worldHips, matAbout(matRot(S.spineR.x), 246, 700));
    const worldChest = matMul(worldSpine, matAbout(matRot(S.chestR.x), 246, 660));
    const worldNeck = matMul(worldChest, matAbout(matMul(matMove(S.neckX.x, S.neckY.x), matRot(S.neckR.x)), 235, 214));
    const worldHead = matMul(worldNeck, matAbout(matMul(matMove(S.headX.x, S.headY.x), matRot(S.headR.x)), 235, 186));
    return { worldHips, worldHead, phi: S.hipsR.x + S.spineR.x + S.chestR.x + S.neckR.x + S.headR.x };
  }

  /** Write the current spring state to the DOM. */
  /**
   * The device's transform, in canvas space.
   *
   * Read twice per frame — once by `pose` to write it, once by the planted-hand
   * IK to find where the rail has got to — so it lives in one place. Two copies
   * of this expression would drift apart the moment either one is tuned.
   *
   * ## The pivot
   *
   * `matAbout(…, 246, 700)` is not decoration. The device is socketed at her
   * waist, so its own roll, aim and recoil have to happen **about the socket**.
   * Rotating about the canvas origin instead — which is what `matRot` alone
   * does — puts the pivot 2121 units away: 2° of aim swung the whole 1150-unit
   * housing 74 units sideways, which reads as the device sliding across the
   * floor rather than turning to look at something. It also made a hand resting
   * on the rail impossible, because the rail was not where the socket said it
   * was.
   */
  private monMatrix(): Mat | null {
    if (!this.monolith) return null;
    const S = this.S;
    const worldHips = matMul(matMove(0, S.rootY.x), matAbout(matMul(matMove(S.hipsX.x, 0), matRot(S.hipsR.x)), 246, 700));
    const monLocal = S.monWorld.x - S.hipsR.x + S.monR.x + S.monAim.x + S.monHit.x;
    return matMul(worldHips, matAbout(matMul(matMove(0, S.monY.x + S.monRecoil.x), matRot(monLocal)), 246, 700));
  }

  private pose() {
    const S = this.S;
    const f = (v: number) => v.toFixed(3);
    const put = (bone: LaciaBone, str: string) => {
      const el = this.bones.get(bone);
      if (el) el.style.transform = str;
    };
    put('root', `translateY(${f(S.rootY.x)}px)`);
    put('hips', `translateX(${f(S.hipsX.x)}px) rotate(${f(S.hipsR.x)}deg)`);
    put('spine', `rotate(${f(S.spineR.x)}deg)`);
    put('chest', `rotate(${f(S.chestR.x)}deg)`);
    /* Translate before rotate: the lateral drift is in the parent's frame (the
       ribcage has moved), while the rotation is about the torso's own pivot.
       Swapping the two would swing the whole upper body around a point 60 units
       below the bust every time it drifted a pixel. */
    put('torso', `translateX(${f(S.torsoShift.x)}px) rotate(${f(S.torsoR.x)}deg) scale(${f(S.torsoX.x)},${f(S.torsoY.x)})`);
    put('neck', `translate(${f(S.neckX.x)}px,${f(S.neckY.x)}px) rotate(${f(S.neckR.x)}deg)`);
    put('head', `translate(${f(S.headX.x)}px,${f(S.headY.x)}px) rotate(${f(S.headR.x)}deg)`);

    const { worldHips, worldHead, phi } = this.chain();

    /* Hair: local = (world the spring has reached) − (world the head is at).
       The fringe is a child of the head, so a local rotation is enough. */
    put('hairFront', `rotate(${f(S.hairFWorld.x - phi)}deg)`);

    /* The back hair lives outside the body chain (it must paint behind it), so
       it gets the composed world matrix of the head instead. */
    const hairB = matMul(worldHead, matAbout(matRot(S.hairBWorld.x - phi), this.pivot.hairBack[0], this.pivot.hairBack[1]));
    put('hairBack', `matrix(${hairB.map((n) => f(n)).join(',')})`);

    put('armR', `rotate(${f(S.armRR.x)}deg)`);
    put('armL', `rotate(${f(S.armLR.x)}deg)`);
    put('legR', `rotate(${f(S.legRR.x)}deg)`);
    put('legL', `rotate(${f(S.legLR.x)}deg)`);
    put('kneeR', `rotate(${f(S.kneeRR.x)}deg)`);
    put('kneeL', `rotate(${f(S.kneeLR.x)}deg)`);
    put('elbowR', `rotate(${f(S.elbowRR.x)}deg)`);
    put('elbowL', `rotate(${f(S.elbowLR.x)}deg)`);
    put('wristR', `rotate(${f(S.wristRR.x)}deg)`);
    put('wristL', `rotate(${f(S.wristLR.x)}deg)`);
    put('ankleR', `rotate(${f(S.ankleRR.x)}deg)`);
    put('ankleL', `rotate(${f(S.ankleLR.x)}deg)`);

    /* Brows and mouth are images inside the head bone, so they need no world
       matrix — the head carries them. Only their own offset is written, and it
       is written to every variant so the stack never desyncs mid-fade. */
    const tilt = S.browTilt.x;
    for (const [group, imgs] of this.brows) {
      /* `brow-r` paints on the viewer's left, so a positive tilt has to rotate
         it clockwise and `-l` the other way — otherwise the pair scissors open
         instead of converging. */
      const inner = group === 'brow-r' ? 1 : -1;
      const t = `translateY(${f(S.browY.x)}px) rotate(${f(tilt * inner)}deg)`;
      for (const img of imgs) img.style.transform = t;
    }
    const mouthT = `scale(${f(S.mouthWide.x)},${f(S.mouthOpen.x)})`;
    for (const img of this.mouths.values()) img.style.transform = mouthT;

    if (this.monolith) {
      const m = this.monMatrix();
      if (m) this.monolith.style.transform = `matrix(${m.map((n) => f(n)).join(',')})`;
    }
  }

  private tickEyes(now: number) {
    if (now > this.blinkAt) {
      const double = Math.random() < 0.28;
      this.blinkUntil = now + 78;
      this.blinkAt = now + (double ? 215 : 2600 + Math.random() * 3600);
    }
    if (now > this.saccadeAt) {
      this.saccadeAt = now + 700 + Math.random() * 2100;
      const [gx, gy] = FORM_GAZE[this.form];
      this.gaze.tx = (Math.random() - 0.5) * 1.5 + this.pointer.sx * 2.4 + gx;
      this.gaze.ty = (Math.random() - 0.5) * 1.0 + this.pointer.sy * 1.4 + gy;
    }
    this.gaze.x += (this.gaze.tx - this.gaze.x) * 0.42;
    this.gaze.y += (this.gaze.ty - this.gaze.y) * 0.42;

    /* Eyelid. Blinking and sleep both close it, but the two transitions are
       asymmetric on purpose: a blink *closes* in one frame (78ms total is only
       four frames at 60Hz — easing the close would mean it never fully shuts)
       and *opens* eased, which is also how a real blink looks. Waking up from
       `sleep` rides the same eased path, so she surfaces over ~150ms instead of
       snapping her eyes open.

       The aperture is not widened for `held`, and that is deliberate: the three
       layers of one eye are separate elements with their own boxes, so scaling
       them all by 1.14 would scale each about a different point and push the
       iris out through the top of the sclera. At ~10 display px the gain would
       be invisible anyway — being startled is carried by the brow offset and the
       round `pout`, not by the eyelid. */
    const closed = this.state === 'sleep' || now < this.blinkUntil;
    if (closed) this.lid = 0.07;
    else this.lid += (1 - this.lid) * 0.35;

    const sx = this.gaze.x.toFixed(2);
    const sy = this.gaze.y.toFixed(2);
    const lid = this.lid.toFixed(3);
    for (const img of this.eyes) {
      const t = this.irises.includes(img) ? `translate(${sx}px,${sy}px)` : '';
      img.style.transform = `${t} scaleY(${lid})`;
    }
  }

  private autoForm(now: number) {
    if (now < this.autoAt) return;
    /* An outfit with no device has no forms to cycle. Without this guard she
       would keep scheduling form changes that `runAction` rejects, and the
       demo would sit on `coffin` forever while burning a timer. */
    if (!this.monolith) return;
    if (this.form === 'coffin') {
      const pool = LACIA_FORM_ORDER.filter((f) => f !== 'coffin');
      this.setForm(pool[Math.floor(Math.random() * pool.length)], false);
      this.autoAt = now + 6000 + Math.random() * 2200;
    } else {
      // The casket is the resting state: hold it much longer than a demo form.
      this.setForm('coffin', false);
      this.autoAt = now + 15000 + Math.random() * 8000;
    }
  }
}

export { LACIA_CANVAS };
