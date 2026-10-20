#!/usr/bin/env node
/**
 * Build a FIELDNOTES `.mascot.zip` from raw PNG/WebP frames.
 *
 *   node skills/fieldnotes-mascot-sourcing/scripts/build-pack.mjs pack.config.json
 *
 * Config (paths are relative to the config file):
 * {
 *   "name": "小葵", "author": "Noraneko Games", "license": "CC-BY 4.0",
 *   "width": 560, "trim": true, "quality": 92,
 *   "out": "out-mascot.zip",
 *   "source": { "idle": "raw/neutral.png", "talk": "raw/open.png" },
 *   "anchors": { "bubble": [0.5, 0.04], "head": [0.5, 0.1] },   // optional
 *   "display": { "mode": "full", "height": 240, "crop": 1 },
 *   "motion": { "breathe": true, "sway": true, "swing": true, "blinkEvery": 5 },
 *   "lines": { "click": ["..."], "night": ["..."] }
 * }
 *
 * Enforces the same limits the import endpoint enforces, so a pack that builds
 * here will not be rejected with a 400.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const STATES = ['idle', 'talk', 'happy', 'held', 'sleep', 'blink'];

const fail = (msg) => {
  console.error('✗ ' + msg);
  process.exit(1);
};

const cfgPath = process.argv[2];
if (!cfgPath) fail('用法：node build-pack.mjs <pack.config.json>');
const cfgFile = path.resolve(cfgPath);
if (!fs.existsSync(cfgFile)) fail('找不到配置文件：' + cfgFile);
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const baseDir = path.dirname(cfgFile);

/* ------------------------------------------------------------ validation */

if (!cfg.name) fail('缺少 name');
if (!cfg.source || !cfg.source.idle) fail('source.idle 是必需的（states.idle 必须存在）');
if (!cfg.out) fail('缺少 out（输出 zip 路径）');

const unknown = Object.keys(cfg.source).filter((s) => !STATES.includes(s));
if (unknown.length) fail('source 里有未知状态：' + unknown.join(', ') + '（允许：' + STATES.join(', ') + '）');

const width = Number(cfg.width ?? 560);
const targetHeight = cfg.height ? Number(cfg.height) : 0;
if (!targetHeight && (!Number.isFinite(width) || width < 200)) fail('width 太小或不是数字');
if (targetHeight && (!Number.isFinite(targetHeight) || targetHeight < 300)) fail('height 太小或不是数字');

const display = { mode: 'full', height: 240, crop: 1, flip: false, shadow: true, outline: 'soft', ...(cfg.display ?? {}) };
if (display.height < 80 || display.height > 520) fail('display.height 必须在 80–520 之间');
if (display.crop < 0.2 || display.crop > 1) fail('display.crop 必须在 0.2–1 之间');
if (!['full', 'bust', 'peek'].includes(display.mode)) fail('display.mode 只能是 full / bust / peek');
if (!['none', 'soft', 'white'].includes(display.outline)) fail('display.outline 只能是 none / soft / white');

const motion = { breathe: true, sway: true, swing: true, blinkEvery: 5, ...(cfg.motion ?? {}) };
if (!(motion.blinkEvery >= 2)) fail('motion.blinkEvery 必须 ≥ 2（接口的 Zod 校验下限）');

/* ------------------------------------------------------------ frames */

const workDir = path.join(path.dirname(path.resolve(baseDir, cfg.out)), '.build-' + path.basename(cfg.out, '.mascot.zip'));
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

const quality = Number(cfg.quality ?? 92);
let canvas = null;
const frames = {};

/** Alpha bounding box of an image buffer, or null when fully transparent. */
async function alphaBBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1, srcW: w, srcH: h };
}

// Trim ONCE, using the union of every frame's alpha box. Trimming each frame
// on its own would give them different crops — the poses would drift sideways
// and the canvas sizes would disagree, which shows up as a jump on every
// state switch.
let crop = null;
if (cfg.trim !== false) {
  const boxes = [];
  for (const rel of Object.values(cfg.source)) {
    const box = await alphaBBox(await sharp(path.resolve(baseDir, rel)).rotate().png().toBuffer());
    if (box) boxes.push(box);
  }
  if (boxes.length) {
    const left = Math.min(...boxes.map((b) => b.left));
    const top = Math.min(...boxes.map((b) => b.top));
    const right = Math.max(...boxes.map((b) => b.left + b.width));
    const bottom = Math.max(...boxes.map((b) => b.top + b.height));
    const srcW = boxes[0].srcW;
    const srcH = boxes[0].srcH;
    if (boxes.some((b) => b.srcW !== srcW || b.srcH !== srcH)) {
      fail('各状态源图尺寸不一致，无法统一裁剪；请先对齐画布，或设置 "trim": false');
    }
    crop = { left, top, width: right - left, height: bottom - top };
    console.log(`  统一裁剪 ${srcW}x${srcH} → ${crop.width}x${crop.height}`);
  }
}

for (const [state, rel] of Object.entries(cfg.source)) {
  const src = path.resolve(baseDir, rel);
  if (!fs.existsSync(src)) fail(`状态 ${state} 的源文件不存在：${src}`);

  let img = sharp(src).rotate();
  if (crop) img = img.extract(crop);
  // Full-body figures are tall and narrow: sizing by width alone inflates the
  // canvas (a 210x936 crop asked to be 560 wide becomes 2496 tall). Use
  // `height` for those; `width` is fine for half-body art.
  img = cfg.height ? img.resize({ height: Number(cfg.height), fit: 'inside' }) : img.resize({ width, fit: 'inside' });

  const buf = await img.webp({ quality }).toBuffer();
  const meta = await sharp(buf).metadata();
  if (!meta.hasAlpha) fail(`${rel} 没有透明通道（可能是假透明/棋盘格），先用 asset-studio 抠图`);

  if (!canvas) canvas = { w: meta.width, h: meta.height };
  else if (meta.width !== canvas.w || meta.height !== canvas.h) {
    fail(`${state} 尺寸 ${meta.width}x${meta.height} 与 idle ${canvas.w}x${canvas.h} 不一致——状态切换会跳动，请检查源图画布`);
  }

  frames[state] = { buf, w: meta.width, h: meta.height, file: state + '.webp' };
  fs.writeFileSync(path.join(workDir, state + '.webp'), buf);
  console.log(`  ${state.padEnd(6)} ${meta.width}x${meta.height}  ${(buf.length / 1024).toFixed(1)}KB`);
}

/* ------------------------------------------------------------ anchors */

// baseline = where the feet are, as a fraction of canvas height
const { data, info } = await sharp(frames.idle.buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
let top = H;
let bottom = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 16) {
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
}
const baseline = +(bottom / H).toFixed(3);
const figureRatio = +((bottom - top) / H).toFixed(3);
if (figureRatio < 0.9) console.warn(`! 人物只占画布高度的 ${(figureRatio * 100).toFixed(0)}%，可能有大量留白`);

const anchors = {
  baseline,
  bubble: cfg.anchors?.bubble ?? [0.5, 0.04],
  head: cfg.anchors?.head ?? [0.5, 0.1],
};

/* ------------------------------------------------------------ manifest */

const manifest = {
  format: 'fieldnotes-mascot@1',
  name: cfg.name,
  author: cfg.author ?? '',
  license: cfg.license ?? '',
  width: canvas.w,
  height: canvas.h,
  states: Object.fromEntries(Object.keys(frames).map((s) => [s, s + '.webp'])),
  anchors,
  display,
  motion,
  lines: cfg.lines ?? { click: ['……'] },
};

fs.writeFileSync(path.join(workDir, 'mascot.json'), JSON.stringify(manifest, null, 2));

/* ------------------------------------------------------------ zip */

const files = {};
for (const f of fs.readdirSync(workDir)) files[f] = new Uint8Array(fs.readFileSync(path.join(workDir, f)));
const zipped = zipSync(files, { level: 6 });
const outFile = path.resolve(baseDir, cfg.out);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, zipped);

const missing = STATES.filter((s) => s !== 'blink' && !frames[s]);
console.log('');
console.log(`✓ ${outFile}`);
console.log(`  ${canvas.w}x${canvas.h} · ${Object.keys(frames).length} 个状态 · ${(zipped.length / 1024).toFixed(1)}KB`);
console.log(`  baseline=${baseline} · 人物占比 ${(figureRatio * 100).toFixed(0)}%`);
if (missing.length) console.log(`  缺失状态将回退到 idle：${missing.join(', ')}`);
