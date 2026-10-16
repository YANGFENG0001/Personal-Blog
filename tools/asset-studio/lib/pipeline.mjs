/**
 * Asset pipeline shared by the CLI and the studio web UI.
 * Input: any image buffer. Output: cleaned, trimmed, compressed WebP files plus
 * a manifest entry describing anchors (baseline, head, bubble).
 */
import sharp from 'sharp';
import { removeBackground, measure, intersectAlpha, analyze } from './matte.mjs';
import { predictAlpha } from './ai.mjs';

export const KINDS = {
  mascot: { label: '看板娘状态图', maxH: 720, matte: true, trim: true },
  sticker: { label: '贴纸 / 装饰', maxH: 480, matte: true, trim: true },
  particle: { label: '粒子小图', maxH: 64, matte: true, trim: true },
  cursor: { label: '光标', maxH: 32, matte: true, trim: true },
  background: { label: '背景图层', maxW: 1920, matte: false, trim: false },
  cover: { label: '主题封面', maxW: 640, matte: false, trim: false },
};

async function raw(buf) {
  const { data, info } = await sharp(buf).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height };
}

const toSharp = (d, w, h) => sharp(Buffer.from(d.buffer, d.byteOffset, d.byteLength), { raw: { width: w, height: h, channels: 4 } });

/**
 * Remove the background.
 * @param {Buffer} buf
 * @param {{mode?:'auto'|'algo'|'ai'|'both'|'none', model?:'anime'|'general', tolerance?:number, keyColor?:number[], feather?:boolean}} opt
 */
export async function matte(buf, opt = {}) {
  const { data, w, h } = await raw(buf);
  const mode = opt.mode ?? 'auto';
  if (mode === 'none') return { data, w, h, info: analyze(data, w, h), method: 'none' };
  let res = { data: Uint8ClampedArray.from(data), info: analyze(data, w, h), removed: 0 };
  let method = 'none';
  if (mode !== 'ai') {
    res = removeBackground(data, w, h, {
      tolerance: opt.tolerance,
      feather: opt.feather,
      ...(opt.keyColor ? { kind: 'solid', color: opt.keyColor } : {}),
    });
    if (res.info.kind !== 'complex') method = 'algo';
  }
  const wantAI = mode === 'ai' || mode === 'both' || (mode === 'auto' && res.info.kind === 'complex');
  if (wantAI) {
    try {
      const alpha = await predictAlpha(sharp, data, w, h, opt.model ?? 'anime');
      if (method === 'algo') intersectAlpha(res.data, alpha);
      else { res.data = Uint8ClampedArray.from(data); intersectAlpha(res.data, alpha); }
      method = method === 'algo' ? 'algo+ai' : 'ai';
    } catch (e) {
      if (mode === 'ai') throw e;
      res.warning = `AI 抠图不可用：${e.message}`;
    }
  }
  return { data: res.data, w, h, info: res.info, method, warning: res.warning };
}

/** Apply a user-painted correction mask: 0 = keep, 1 = erase, 2 = restore (from the original). */
export async function applyCorrections(cleaned, original, edits) {
  const { data: o } = await raw(original);
  const d = cleaned.data;
  for (let p = 0; p < edits.length; p++) {
    if (edits[p] === 1) d[p * 4 + 3] = 0;
    else if (edits[p] === 2) { d[p * 4] = o[p * 4]; d[p * 4 + 1] = o[p * 4 + 1]; d[p * 4 + 2] = o[p * 4 + 2]; d[p * 4 + 3] = 255; }
  }
  return cleaned;
}

/**
 * Trim, resize and encode. Returns { webp, webp2x?, png, width, height, anchors }.
 * @param {{data:Uint8ClampedArray,w:number,h:number}} img
 */
export async function finish(img, kind = 'mascot', opt = {}) {
  const k = KINDS[kind] ?? KINDS.mascot;
  let { data, w, h } = img;
  let anchors = null;
  if (k.trim) {
    const m = measure(data, w, h, 48);
    if (!m) throw new Error('抠图后没有剩下任何内容，请调低容差或改用 AI 模式');
    const pad = Math.round(Math.max(m.box.width, m.box.height) * 0.01);
    const x = Math.max(0, m.box.x - pad), y = Math.max(0, m.box.y - pad);
    const cw = Math.min(w - x, m.box.width + pad * 2), ch = Math.min(h - y, m.box.height + pad * 2);
    const cropped = await toSharp(data, w, h).extract({ left: x, top: y, width: cw, height: ch }).raw().toBuffer();
    data = new Uint8ClampedArray(cropped.buffer, cropped.byteOffset, cropped.byteLength);
    w = cw;
    h = ch;
    anchors = measure(data, w, h)?.anchors ?? null;
  }
  const target = k.maxH ? { height: Math.min(h, k.maxH * 2) } : { width: Math.min(w, (k.maxW ?? w) * 1) };
  const base = toSharp(data, w, h);
  const enc = (s) => s.webp({ quality: opt.quality ?? 86, alphaQuality: 90, effort: 5, smartSubsample: true }).toBuffer();
  const one = k.maxH ? { height: Math.min(h, k.maxH) } : { width: Math.min(w, k.maxW ?? w) };
  const webp = await enc(base.clone().resize({ ...one, withoutEnlargement: true }));
  const meta = await sharp(webp).metadata();
  const webp2x = k.maxH && h > k.maxH * 1.3 ? await enc(base.clone().resize({ ...target, withoutEnlargement: true })) : null;
  const png = await base.clone().png({ compressionLevel: 9 }).toBuffer();
  return { webp, webp2x, png, width: meta.width, height: meta.height, anchors };
}

/** Split a sticker sheet (several separate elements on one transparent canvas) into pieces. */
export async function splitSheet(img, minArea = 400) {
  const { data, w, h } = img;
  const N = w * h;
  const seen = new Uint8Array(N);
  const boxes = [];
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (seen[s] || data[s * 4 + 3] < 24) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      // 8-neighbourhood with a 2px reach so thin gaps inside one element don't split it
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (!seen[q] && data[q * 4 + 3] >= 24) { seen[q] = 1; stack.push(q); }
      }
    }
    if (n >= minArea) boxes.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, area: n });
  }
  boxes.sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.height, b.height) / 2 ? a.y - b.y : a.x - b.x));
  const out = [];
  for (const b of boxes) {
    const buf = await toSharp(data, w, h).extract({ left: b.x, top: b.y, width: b.width, height: b.height }).png().toBuffer();
    out.push({ box: b, png: buf });
  }
  return out;
}

/** Composite a processed image onto a backdrop colour (for previews). */
export async function previewOn(png, color) {
  const m = await sharp(png).metadata();
  return sharp({ create: { width: m.width, height: m.height, channels: 4, background: color } }).composite([{ input: png }]).png().toBuffer();
}
