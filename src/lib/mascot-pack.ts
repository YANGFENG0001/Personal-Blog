/**
 * Mascot pack ("角色包") format, shared by the site (import / render) and the
 * local asset studio (export). A pack is a zip:
 *
 *   mascot.json            — this manifest
 *   idle.webp              — required
 *   talk.webp, happy.webp, held.webp, sleep.webp, blink.webp — optional states
 *
 * All state images share one canvas size and pose so they can be swapped
 * in place. Anchors are fractions of that canvas (0..1).
 */
import { z } from 'zod';

export const MASCOT_STATES = ['idle', 'talk', 'happy', 'held', 'sleep', 'blink'] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

export const STATE_LABELS: Record<MascotState, string> = {
  idle: '默认（必需）',
  talk: '说话',
  happy: '开心',
  held: '被拎起（拖动中）',
  sleep: '睡觉（深夜 / 久未操作）',
  blink: '闭眼（用于眨眼）',
};

export const LINE_GROUPS = ['click', 'morning', 'noon', 'evening', 'night', 'home', 'article', 'notFound', 'readEnd', 'drag', 'drop', 'reset'] as const;
export type LineGroup = (typeof LINE_GROUPS)[number];

export const LINE_GROUP_LABELS: Record<LineGroup, string> = {
  click: '点击（通用）',
  morning: '早上 5–11 点',
  noon: '中午 11–14 点',
  evening: '傍晚 17–20 点',
  night: '深夜 23–5 点',
  home: '在首页',
  article: '在文章页',
  notFound: '在 404 页',
  readEnd: '读完一篇文章',
  drag: '被拖起来时',
  drop: '被放下时',
  reset: '双击回到角落',
};

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
    })
    .default({ breathe: true, sway: true, swing: true, blinkEvery: 5 }),
  lines: z.object(Object.fromEntries(LINE_GROUPS.map((g) => [g, z.array(line).max(40).optional()])) as Record<LineGroup, z.ZodOptional<z.ZodArray<typeof line>>>).default({}),
});

export type MascotPack = z.infer<typeof mascotPackSchema>;

/** Pack as stored on the server: manifest + URLs of the stored images. */
export interface StoredMascotPack extends MascotPack {
  id: string;
  urls: Partial<Record<MascotState, string>>;
}

/** Lines for an event; falls back to the generic click lines. */
export function pickLines(pack: Pick<MascotPack, 'lines'>, group: LineGroup): string[] {
  const own = pack.lines[group];
  return own && own.length ? own : (pack.lines.click ?? []);
}
