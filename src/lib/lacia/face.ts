/**
 * Expression variants — the bitmaps `docs/lacia-rig/gen_face_variants.py` bakes.
 *
 * The See-through split gave exactly one bitmap per brow and one closed-mouth
 * bitmap, so the rig could only *displace* them: raise, lower, tilt, press. The
 * shapes it could not reach — a furrowed brow, a raised brow, a smile, a parted
 * mouth — are baked here as real images, which keeps the rig's one rule intact:
 * every part is a rigid bitmap, and any warping happened offline, once.
 *
 * All variants of a feature share one padded box (`FACE_PAD` of transparent
 * margin, baked into the file). That is not cosmetic: `transform-origin:
 * 50% 50%` is relative to the element's own box, so if the furrow image were
 * 7px tall and the neutral 19px they would rotate about points 6px apart and
 * slide out of alignment mid-tilt. Same box, same transform, no drift.
 */
import type { LaciaPart } from './parts';

export type BrowVariant = 'neutral' | 'furrow' | 'raise' | 'drop';
export type MouthVariant = 'neutral' | 'smile' | 'open' | 'grin' | 'pout' | 'sleep';
export type FaceSide = 'r' | 'l';

/** Transparent margin baked above and below every variant file. */
export const FACE_PAD = 6;

export const BROW_VARIANTS: readonly BrowVariant[] = ['neutral', 'furrow', 'raise', 'drop'];
export const MOUTH_VARIANTS: readonly MouthVariant[] = ['neutral', 'smile', 'open', 'grin', 'pout', 'sleep'];

/** Canvas geometry of the unpadded feature (mirrors parts.ts). */
const BROW_BASE: Record<FaceSide, LaciaPart> = {
  r: { id: 'eyebrow-r', file: 'eyebrow-r.webp', x: 185, y: 93, w: 45, h: 7, z: 13 },
  l: { id: 'eyebrow-l', file: 'eyebrow-l.webp', x: 257, y: 93, w: 34, h: 9, z: 14 },
};
const MOUTH_BASE: LaciaPart = { id: 'mouth', file: 'mouth.webp', x: 230, y: 162, w: 20, h: 7, z: 12 };

/** Ids that `parts.ts` still exports but the face stack now owns. */
export const FACE_IDS = new Set(['eyebrow-r', 'eyebrow-l', 'mouth']);

const padded = (p: LaciaPart): LaciaPart => ({
  ...p,
  y: p.y - FACE_PAD,
  h: p.h + FACE_PAD * 2,
});

export function browParts(side: FaceSide): { v: BrowVariant; part: LaciaPart }[] {
  const geo = padded(BROW_BASE[side]);
  return BROW_VARIANTS.map((v) => ({ v, part: { ...geo, file: `brow-${side}-${v}.webp` } }));
}

export function mouthParts(): { v: MouthVariant; part: LaciaPart }[] {
  const geo = padded(MOUTH_BASE);
  return MOUTH_VARIANTS.map((v) => ({ v, part: { ...geo, file: `mouth-${v}.webp` } }));
}

/**
 * Which shape each state and each device form asks for.
 *
 * A state wins over a form while it lasts (a happy mood is a happy mood in any
 * form); the form is the fallback. Both are *shapes* — the continuous springs in
 * `rig.ts` still run on top, so the brow can be in the furrow bitmap and still
 * travel a few pixels as she moves.
 *
 * The five states must be *distinguishable by shape alone*, because at 9 display
 * px a difference in position is invisible while a difference in silhouette is
 * not. That is why `held` and `happy` do not share a mouth: both raise the brow
 * and flush the cheeks, so if they also shared a mouth they would be the same
 * face. `held` gets the round `pout` (startled), `happy` the toothed `grin`.
 * `sleep` gets `drop` + `sleep` for the same reason — the old mapping reused
 * `neutral`/`neutral`, which is a *thinking* face with the eyes shut, not a
 * sleeping one.
 */
export const STATE_FACE: Record<string, { brow: BrowVariant; mouth: MouthVariant }> = {
  idle: { brow: 'neutral', mouth: 'neutral' },
  talk: { brow: 'neutral', mouth: 'open' },
  happy: { brow: 'raise', mouth: 'grin' },
  held: { brow: 'raise', mouth: 'pout' },
  sleep: { brow: 'drop', mouth: 'sleep' },
};

export const FORM_FACE: Record<string, { brow: BrowVariant; mouth: MouthVariant }> = {
  coffin: { brow: 'neutral', mouth: 'neutral' },
  railgun: { brow: 'furrow', mouth: 'neutral' },
  shield: { brow: 'furrow', mouth: 'open' },
  unfold: { brow: 'raise', mouth: 'smile' },
};

/** States that flush her cheeks. A gradient, not a bitmap — blush is soft and
 *  symmetric, and a 32×15 radial gradient costs less than another layer. */
export const BLUSH_STATES = new Set(['happy', 'held']);
