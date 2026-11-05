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
/* Type-only: erased at build time, so importing this module in the browser does
   not pull in the schema (and zod). */
import type { MascotPack } from './mascot-pack-schema';

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

export const LINE_GROUPS = [
  'click',
  'morning',
  'noon',
  'evening',
  'night',
  'home',
  'article',
  'notFound',
  'readEnd',
  'drag',
  'drop',
  'reset',
  'formCoffin',
  'formRailgun',
  'formShield',
  'formUnfold',
] as const;
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
  formCoffin: '装置 · 收束',
  formRailgun: '装置 · 轨道炮',
  formShield: '装置 · 护盾',
  formUnfold: '装置 · 展开',
};

/**
 * Groups that only a rigged character with a device can trigger. The pack
 * editor shows them apart so ordinary state-image packs are not asked to fill
 * in four boxes that will never fire.
 */
export const DEVICE_LINE_GROUPS: readonly LineGroup[] = ['formCoffin', 'formRailgun', 'formShield', 'formUnfold'];

/**
 * The manifest schema lives in `mascot-pack-schema.ts` — it is the only part of
 * this module that needs zod, and the browser imports the rest. Re-exported as
 * types so callers keep one import site; `export type` is erased at build time,
 * so this adds no runtime dependency on the schema module.
 */
export type { MascotPack, StoredMascotPack } from './mascot-pack-schema';

/** Lines for an event; falls back to the generic click lines. */
export function pickLines(pack: Pick<MascotPack, 'lines'>, group: LineGroup): string[] {
  const own = pack.lines[group];
  return own && own.length ? own : (pack.lines.click ?? []);
}
