/**
 * The zod schema for a pack manifest, kept apart from `mascot-pack.ts` on
 * purpose.
 *
 * `mascot-pack.ts` holds the runtime bits the browser needs (state names, line
 * groups, `pickLines`), and the corner mascot's client script imports it. While
 * the schema lived in the same module, `import { pickLines } from './mascot-pack'`
 * dragged zod into every page: measured on the built site it was a 26 KB (gz)
 * chunk that the reader downloaded, decoded and parsed to pick a random line.
 * Nothing on the client validates a manifest — only the server does, on import.
 *
 * So: schema here, imported by server code only; `mascot-pack.ts` re-exports the
 * types with `export type`, which is erased at build time and creates no runtime
 * edge back to this file.
 */
import { z } from 'zod';
import { LINE_GROUPS, MASCOT_STATES, type LineGroup, type MascotState } from './mascot-pack';

const frac = z.number().min(0).max(1);
const line = z.string().trim().min(1).max(60);

export const mascotPackSchema = z.object({
  format: z.literal('fieldnotes-mascot@1'),
  name: z.string().trim().min(1).max(40),
  author: z.string().trim().max(60).default(''),
  license: z.string().trim().max(120).default(''),
  /** Canvas size shared by every state image (px, at 1x). */
  width: z.number().int().min(16).max(4096),
  height: z.number().int().min(16).max(4096),
  states: z
    .object(Object.fromEntries(MASCOT_STATES.map((s) => [s, z.string().regex(/^[a-z]+\.(webp|png)$/).optional()])) as Record<MascotState, z.ZodOptional<z.ZodString>>)
    .refine((s) => !!s.idle, '必须提供 idle 默认状态图'),
  anchors: z
    .object({
      /** Feet line (fraction of height from the top). */
      baseline: frac.default(1),
      /** Where the speech bubble points. */
      bubble: z.tuple([frac, frac]).default([0.5, 0.05]),
      /** Head centre — used for the "peek from the edge" crop. */
      head: z.tuple([frac, frac]).default([0.5, 0.12]),
    })
    .default({ baseline: 1, bubble: [0.5, 0.05], head: [0.5, 0.12] }),
  display: z
    .object({
      /** full: whole figure; bust: lower part fades out; peek: only the head pops in from the screen edge. */
      mode: z.enum(['full', 'bust', 'peek']).default('full'),
      /** Rendered height in CSS px at size "md". */
      height: z.number().int().min(80).max(520).default(240),
      /**
       * How much of the figure is revealed, measured from the top (1 = the
       * whole figure). The figure keeps its scale — lowering this crops the
       * bottom away, so the mascot sits shorter against the screen edge.
       */
      crop: z.number().min(0.2).max(1).default(1),
      flip: z.boolean().default(false),
      shadow: z.boolean().default(true),
      outline: z.enum(['none', 'soft', 'white']).default('soft'),
    })
    .default({ mode: 'full', height: 240, crop: 1, flip: false, shadow: true, outline: 'soft' }),
  motion: z
    .object({
      breathe: z.boolean().default(true),
      sway: z.boolean().default(true),
      /** Swing like a hanging doll while dragged. */
      swing: z.boolean().default(true),
      /** Blink interval in seconds (needs a blink image). */
      blinkEvery: z.number().min(2).max(20).default(5),
      /**
       * Per-part warping (hair / head / torso / hem) so a flat illustration
       * moves like a figure rather than a sticker. Costs nothing extra — the
       * displacement maps are drawn from the anchors at runtime.
       */
      warp: z.boolean().default(true),
      /** Warp amplitude multiplier: 0 is still, 1 is the tuned default. */
      warpIntensity: z.number().min(0).max(2).default(1),
    })
    .default({ breathe: true, sway: true, swing: true, blinkEvery: 5, warp: true, warpIntensity: 1 }),
  lines: z.object(Object.fromEntries(LINE_GROUPS.map((g) => [g, z.array(line).max(40).optional()])) as Record<LineGroup, z.ZodOptional<z.ZodArray<typeof line>>>).default({}),
});

export type MascotPack = z.infer<typeof mascotPackSchema>;

/** Pack as stored on the server: manifest + URLs of the stored images. */
export interface StoredMascotPack extends MascotPack {
  id: string;
  urls: Partial<Record<MascotState, string>>;
}
