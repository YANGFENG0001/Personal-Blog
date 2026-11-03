/**
 * Lacia rig — a real skeleton over the 24 layers See-through split out.
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
import { FACE_IDS, FACE_PAD, FORM_FACE, STATE_FACE, BLUSH_STATES, browParts, mouthParts, type BrowVariant, type MouthVariant } from './face';
import { buildScript, type SayLine, type VisemeCue } from '../viseme';
import { LACIA_FORM_ORDER, type LaciaForm } from './lines';
import { monolithSvg } from './monolith';

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

/** Joint positions, in canvas px. */
const PIVOT: Record<LaciaBone, readonly [number, number]> = {
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
  /* Measured by `export_assets.py` as the narrowest row of each leg's
     silhouette, so it stays correct if the layers are ever re-split. */
  kneeR: LACIA_KNEE.r,
  kneeL: LACIA_KNEE.l,
  elbowR: LACIA_ELBOW.r,
  elbowL: LACIA_ELBOW.l,
  /* The wrist is measured *inside the forearm crop* — searching the whole arm
     for the narrowest row finds this same point, but searching it for "the
     elbow" finds it too, which is how the first rig ended up with a hand that
     swivelled on the elbow. */
  wristR: LACIA_WRIST.r,
  wristL: LACIA_WRIST.l,
  /* The boot cuff. The boot is one piece, so this pivot is the only thing that
     separates the ankle from the shin. */
  ankleR: LACIA_ANKLE.r,
  ankleL: LACIA_ANKLE.l,
};

const EYE = new Set(['eyewhite-r', 'eyewhite-l', 'irides-r', 'irides-l', 'eyelash-r', 'eyelash-l']);

const DEFAULT_BASE = '/lacia-rig/parts/';

export interface LaciaRigOptions {
  /** Directory holding the part bitmaps. */
  base?: string;
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

const deviceLock = `<svg class="lr-device-lock" viewBox="0 0 200 90" aria-hidden="true">
            <g class="lr-dl-plate"><path d="M100 45 L58 31 L40 42 L60 54 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L58 59 L40 48 L60 36 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L142 31 L160 42 L140 54 Z"/></g>
            <g class="lr-dl-plate"><path d="M100 45 L142 59 L160 48 L140 36 Z"/></g>
            <circle class="lr-dl-core" cx="100" cy="45" r="4.5"/>
          </svg>`;

function partsFor(base: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of LACIA_PARTS) {
    /* Brows and mouth are replaced by the variant stack below — the raw
       exports would otherwise sit under it and show through the cross-fade. */
    if (FACE_IDS.has(p.id)) continue;
    const bone = BONE_OF[p.id] ?? 'head';
    const img =
      `<img class="lr-part" src="${base}${p.file}" alt="" draggable="false" decoding="async"` +
      ` width="${p.w}" height="${p.h}"` +
      ` style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.z}">`;
    out[bone] = (out[bone] ?? '') + img;
  }
  return out;
}

/** One stacked image per variant; `opacity` picks the shape, not `src`, so a
 *  change cross-fades instead of flashing an unloaded file. */
function faceStack(base: string): string {
  const img = (p: { file: string; x: number; y: number; w: number; h: number; z: number }, v: string, group: string, on: boolean) =>
    `<img class="lr-part lr-face" data-face="${group}" data-v="${v}"${on ? ' data-on' : ''}` +
    ` src="${base}${p.file}" alt="" draggable="false" decoding="async"` +
    ` width="${p.w}" height="${p.h}"` +
    ` style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.z}">`;

  return [
    ...(['r', 'l'] as const).flatMap((side) =>
      browParts(side).map(({ v, part }) => img(part, v, `brow-${side}`, v === 'neutral')),
    ),
    ...mouthParts().map(({ v, part }) => img(part, v, 'mouth', v === 'neutral')),
  ].join('');
}

/** Cheek flush: two soft gradients, painted between the face and the eyes.
 *  Canvas coords — the face spans x 171–305, the eyes sit at y 108–130. */
const blush = `<div class="lr-blush" style="left:188px;top:141px;width:34px;height:16px"></div>
                  <div class="lr-blush" style="left:256px;top:141px;width:34px;height:16px"></div>`;

/**
 * Server-renderable skeleton. The island renders this string so the figure is
 * painted before any JavaScript runs; `LaciaRig` then adopts the same nodes.
 */
export function laciaMarkup(opts: { base?: string; uid?: string } = {}): string {
  const base = opts.base ?? DEFAULT_BASE;
  const uid = opts.uid ?? 'lacia-mono';
  const p = partsFor(base);
  return `<div class="lr-stage">
      <div class="lr-bones">
        <div class="lr-bone lr-hairback" data-bone="hairBack">${p.hairBack ?? ''}</div>
        <div class="lr-bone lr-root" data-bone="root">
          <div class="lr-bone lr-hips" data-bone="hips">
            ${deviceLock}
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
                <div class="lr-bone lr-arm" data-bone="armR">
                  <div class="lr-bone lr-elbow" data-bone="elbowR">
                    <div class="lr-bone lr-wrist" data-bone="wristR">${p.wristR ?? ''}</div>${p.elbowR ?? ''}
                  </div>${p.armR ?? ''}
                </div>
                <div class="lr-bone lr-arm" data-bone="armL">
                  <div class="lr-bone lr-elbow" data-bone="elbowL">
                    <div class="lr-bone lr-wrist" data-bone="wristL">${p.wristL ?? ''}</div>${p.elbowL ?? ''}
                  </div>${p.armL ?? ''}
                </div>
                <div class="lr-bone lr-torso" data-bone="torso">${p.torso ?? ''}</div>
                <div class="lr-bone lr-neck" data-bone="neck">${p.neck ?? ''}
                  <div class="lr-bone lr-head" data-bone="head">${p.head ?? ''}${blush}${faceStack(base)}
                    <div class="lr-bone lr-hairfront" data-bone="hairFront">${p.hairFront ?? ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${monolithSvg(uid)}
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

const ENERGY: Record<LaciaState, number> = { idle: 1, talk: 1.15, happy: 1.3, held: 1.7, sleep: 0.4 };

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
 */
const FORM_POSE: Record<
  LaciaForm,
  {
    rootY: number; hipsX: number; spine: number; chest: number; head: number;
    armR: number; armL: number; elbowR: number; elbowL: number; wristR: number; wristL: number;
  }
> = {
  coffin: { rootY: 0, hipsX: 0, spine: 0, chest: 0, head: 0, armR: 0, armL: 0, elbowR: 0, elbowL: 0, wristR: 0, wristL: 0 },
  /* `elbowL` is what finally makes "扶导轨" possible: the upper arm swings out
     to the device and the forearm comes back to meet the rail. With one rigid
     arm the hand stopped ~15px short of it and the pose read as reaching. */
  /* `wristL` closes the grip: the rail runs under her palm, so the hand turns
     in toward the device while the forearm comes back to meet it. Without this
     the fingers stay parallel to the forearm and the pose reads as "hand near
     rail", not "hand on rail". */
  railgun: { rootY: 9, hipsX: 6, spine: 3, chest: 8, head: -4, armR: 8, armL: -16, elbowR: 4, elbowL: 6, wristR: 0, wristL: -20 },
  /* Forearm across the body — the one pose that is impossible without an elbow. */
  shield: { rootY: 3, hipsX: -5, spine: -2, chest: -7, head: 6, armR: -6, armL: 8, elbowR: -4, elbowL: 30, wristR: 0, wristL: 9 },
  unfold: { rootY: -5, hipsX: 0, spine: 1, chest: 3, head: -3, armR: 17, armL: -17, elbowR: 8, elbowL: -8, wristR: 0, wristL: 0 },
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

export class LaciaRig {
  readonly el: HTMLElement;
  private readonly bones = new Map<LaciaBone, HTMLElement>();
  private readonly eyes: HTMLImageElement[] = [];
  private readonly irises: HTMLImageElement[] = [];
  /** Group ('brow-r' | 'brow-l') → every variant image of that brow. */
  private readonly brows = new Map<string, HTMLImageElement[]>();
  private readonly mouths = new Map<MouthVariant, HTMLImageElement>();
  private browVariant: BrowVariant = 'neutral';
  private mouthVariant: MouthVariant = 'neutral';
  private readonly monolith: SVGElement;
  private readonly lock: SVGElement | null;

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

  private readonly S = {
    rootY: new Spring(1.6, 1.0),
    hipsX: new Spring(0.7, 0.9),
    hipsR: new Spring(0.7, 0.9),
    spineR: new Spring(0.9, 0.85),
    chestR: new Spring(1.1, 0.8),
    torsoY: new Spring(0.6, 1.0, 1),
    torsoX: new Spring(0.6, 1.0, 1),
    neckR: new Spring(1.3, 0.8),
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
       Same idea for the boot, one step slower: a boot has mass. */
    wristRR: new Spring(1.45, 0.5),
    wristLR: new Spring(1.45, 0.5),
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
    this.opts = { base: DEFAULT_BASE, uid: 'lacia-mono', autoForms: false, ...opts };
    this.energy = opts.energy ?? 1;
    this.reduced = opts.reduced ?? false;

    host.classList.add('lr');
    if (!host.querySelector('.lr-stage')) host.innerHTML = laciaMarkup({ base: this.opts.base, uid: this.opts.uid });
    this.el = host;

    host.querySelectorAll<HTMLElement>('[data-bone]').forEach((el) => {
      const bone = el.dataset.bone as LaciaBone;
      this.bones.set(bone, el);
      const p = PIVOT[bone];
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

    this.monolith = host.querySelector<SVGElement>('.lr-monolith')!;
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

  /** One-off reaction to a click. */
  poke() {
    this.S.headR.kick(-11);
    this.S.headY.kick(4);
    /* A poke used to move only her head, which is the whole reason she read as
       a bobblehead on a stick. Weight drops into one knee, the hips take a
       small shove, and the knees take it unevenly — she catches herself. */
    this.S.kneeRR.impulse(2.8);
    this.S.kneeLR.impulse(-1.5);
    this.S.hipsX.kick(1.6);
    // The device is socketed to her, so a jolt through her body reaches it too.
    // Without this she flinches and the hardware does not, which is the fastest
    // way to make an attachment look fake. 2.6° is ~50 units at the muzzle,
    // which is the smallest swing that reads at the corner-mascot size.
    this.S.monHit.impulse(-2.6);
  }

  setForm(form: LaciaForm, manual = true) {
    if (form === this.form) return;
    this.form = form;
    if (this.monolith) this.monolith.dataset.form = form;
    // The host carries the form too: the barrier has to paint in front of her,
    // which is a stacking decision the stylesheet makes from this attribute.
    this.el.dataset.form = form;
    this.lock?.classList.toggle('is-unlocked', form !== 'coffin');
    /* What she does about it. A form switch used to move only the device, which
       is the mechanical half of the problem: hardware that reconfigures while
       the person holding it stands perfectly still reads as a cut-scene. Each
       form now has a reaction, and the reaction is the *consequence* of the
       hardware rather than a decorative wobble.
         railgun  the rails throw; she absorbs it — hips back, chest back, both
                  arms pushed, and the head snaps a beat later once the slug has
                  left.
         unfold   eight plates lock out at once; the impulse goes through her
                  shoulders, so the device swings and the head lifts.
         shield   nothing is thrown, so nothing recoils — it just settles. */
    if (form === 'railgun') {
      this.recoil();
      this.S.hipsX.kick(-11);
      this.S.chestR.kick(-3.4);
      this.S.armRR.kick(5);
      this.S.armLR.kick(-7);
      /* She drops her weight to take the recoil. Without this the upper body
         braces while the legs stay in the neutral standing pose, and the pose
         reads as pasted-on above the waist. */
      this.S.kneeRR.impulse(3.4);
      this.S.kneeLR.impulse(2.6);
      /* The device's own swing, in degrees: the rails throw and the whole
         housing rocks back on its mount before the cradle catches it. */
      this.S.monHit.impulse(-3.2);
      setTimeout(() => this.S.headR.kick(-13), 260);
    } else if (form === 'unfold') {
      /* Eight plates lock out at once — the heaviest impulse of the four, so
         the biggest swing. */
      this.S.monHit.impulse(-4.4);
      this.S.headR.kick(-5);
      this.S.armRR.kick(4);
      this.S.armLR.kick(-4);
    }
    this.opts.onForm?.(form, manual);
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

  private recoil() {
    this.S.monRecoil.kick(420);
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

    const FIXED = 1 / 120;
    const P = FORM_POSE[this.form];
    let n = 0;
    while (this.acc >= FIXED && n++ < 24) {
      this.acc -= FIXED;
      const S = this.S;
      S.rootY.step(breath * 1.0 * e + P.rootY, FIXED);
      S.hipsX.step(sway * 2.3 * e + P.hipsX, FIXED);
      S.hipsR.step(sway * 0.42 * e, FIXED);
      /* `spineR` is stepped *below*, after `monAim`, because the device's
         reaction feeds into it. */
      S.chestR.step((breath * 0.22 + micro * 0.1) * e + P.chest, FIXED);
      S.torsoY.step(1 + breath * 0.011 * e, FIXED);
      S.torsoX.step(1 - breath * 0.0045 * e, FIXED);
      S.neckR.step((look * 1.1 + micro * 0.22) * e, FIXED);
      S.neckY.step(-breath * 2.0 * e, FIXED);
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
       * the targets, so it cannot run ahead of the body it is correcting. 0.55
       * rather than 1.0 on purpose: a fully stabilised head looks like a
       * chicken and stops belonging to the body. */
      const torsoWorld = S.hipsR.x + S.spineR.x + S.chestR.x + S.neckR.x;
      S.headR.step(
        (sway * 0.42 + micro * 0.42 + look * 2.9 + S.headTurn.x) * e + P.head - torsoWorld * 0.55,
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
       * `weight` is +1 when her weight is on the left foot, −1 on the right,
       * and its period (24s) is deliberately not a multiple of `sway`'s (12s),
       * so the combination takes a couple of minutes to repeat. */
      const weight = Math.sin(t * TAU * 0.041 + 0.9);
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
      S.armRR.step((micro * 0.55 + weight * 0.55) * e + P.armR - torsoWorld * 0.45, FIXED);
      S.armLR.step((-micro * 0.55 - weight * 0.55) * e + P.armL - torsoWorld * 0.45, FIXED);
      /* Elbows carry the arm's swing a little late and a little less, so the
         forearm trails the upper arm instead of moving as one rod. The slow
         independent term is what keeps the arms from looking pinned — an arm
         held at exactly one angle reads as a mannequin even when the shoulder
         is moving. */
      S.elbowRR.step(-S.armRR.x * 0.35 + (1.1 + 0.8 * Math.sin(t * TAU * 0.071 + 0.6)) * e + P.elbowR, FIXED);
      S.elbowLR.step(-S.armLR.x * 0.35 + (1.1 + 0.8 * Math.sin(t * TAU * 0.059 + 2.4)) * e + P.elbowL, FIXED);
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
      S.wristRR.step(
        -S.elbowRR.x * 0.28 + (0.9 + 0.7 * Math.sin(t * TAU * 0.093 + 1.9)) * e + P.wristR,
        FIXED,
      );
      S.wristLR.step(
        -S.elbowLR.x * 0.28 +
          (0.9 + 0.7 * Math.sin(t * TAU * 0.077 + 4.1)) * e +
          P.wristL +
          S.monAim.x * 0.55 * grip,
        FIXED,
      );
      /* ── hips and legs ──────────────────────────────────────────────────
       *
       * The thigh term is the *sum* of two things: the whole-body sway (both
       * legs lean the same way, which is what a body does when it leans) and
       * the weight transfer (the legs lean opposite ways, which is what a body
       * does when it shifts from one foot to the other). Keeping them separate
       * is why this reads as standing rather than as swaying. */
      S.legRR.step((sway * 1.15 + weight * 0.85) * e, FIXED);
      S.legLR.step((sway * 1.15 - weight * 0.85) * e, FIXED);
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
         `sleep` keep their much larger soft values. */
      S.kneeRR.step(
        -S.legRR.x * 0.85 +
          (kneeSoft * (1.45 - 0.9 * loadR) + 1.5 * Math.sin(t * TAU * 0.107) + 0.8 * Math.sin(t * TAU * 0.043 + 1.3)) * e,
        FIXED,
      );
      S.kneeLR.step(
        -S.legLR.x * 0.85 +
          (kneeSoft * (1.45 - 0.9 * loadL) + 1.5 * Math.sin(t * TAU * 0.089 + 2.1) + 0.8 * Math.sin(t * TAU * 0.051 + 0.4)) * e,
        FIXED,
      );
      /* ── ankles ─────────────────────────────────────────────────────────
       *
       * This is the joint that keeps her feet on the ground. Because the shin is
       * driven by a counter-rotation, the boot inherits that swing — and a boot
       * that tilts with the shin is the single clearest sign that a rig has no
       * ankle at all: she reads as standing on two stilts hinged at the knee.
       *
       * Cancelling ~80% of the shin's angle keeps the sole level; the leftover
       * 20% is what gives the ankle something to do. As with the knee, this is
       * a front view, so a real dorsiflexion (toes up) would be invisible —
       * what reads from the front is the *sole's* angle, which is exactly what
       * this term controls.
       *
       * The independent terms run on different periods per side, and the loaded
       * foot is the stiller one: it is the one carrying her. */
      S.ankleRR.step(
        -S.kneeRR.x * 0.8 + (0.7 + 0.55 * Math.sin(t * TAU * 0.13 + 2.2)) * (1.3 - 0.6 * loadR) * e,
        FIXED,
      );
      S.ankleLR.step(
        -S.kneeLR.x * 0.8 + (0.7 + 0.55 * Math.sin(t * TAU * 0.111 + 0.5)) * (1.3 - 0.6 * loadL) * e,
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
      S.spineR.step((-sway * 0.3 + look * 0.45) * e + P.spine - S.monAim.v * 0.045, FIXED);
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
    const worldNeck = matMul(worldChest, matAbout(matMul(matMove(0, S.neckY.x), matRot(S.neckR.x)), 235, 214));
    const worldHead = matMul(worldNeck, matAbout(matMul(matMove(S.headX.x, S.headY.x), matRot(S.headR.x)), 235, 186));
    return { worldHips, worldHead, phi: S.hipsR.x + S.spineR.x + S.chestR.x + S.neckR.x + S.headR.x };
  }

  /** Write the current spring state to the DOM. */
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
    put('torso', `scale(${f(S.torsoX.x)},${f(S.torsoY.x)})`);
    put('neck', `translateY(${f(S.neckY.x)}px) rotate(${f(S.neckR.x)}deg)`);
    put('head', `translate(${f(S.headX.x)}px,${f(S.headY.x)}px) rotate(${f(S.headR.x)}deg)`);

    const { worldHips, worldHead, phi } = this.chain();

    /* Hair: local = (world the spring has reached) − (world the head is at).
       The fringe is a child of the head, so a local rotation is enough. */
    put('hairFront', `rotate(${f(S.hairFWorld.x - phi)}deg)`);

    /* The back hair lives outside the body chain (it must paint behind it), so
       it gets the composed world matrix of the head instead. */
    const hairB = matMul(worldHead, matAbout(matRot(S.hairBWorld.x - phi), PIVOT.hairBack[0], PIVOT.hairBack[1]));
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
      /* Socket attachment. `worldHips` already carries her rotation and lift, so
         the device inherits those for free; what is added here is its own lag
         (`monWorld − hipsR`, the local part of the spring-bone pair), its idle
         roll, its aim, and the recoil impulse. */
      const monLocal = S.monWorld.x - S.hipsR.x + S.monR.x + S.monAim.x + S.monHit.x;
      const m = matMul(worldHips, matMul(matMove(0, S.monY.x + S.monRecoil.x), matRot(monLocal)));
      this.monolith.style.transform = `matrix(${m.map((n) => f(n)).join(',')})`;
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
