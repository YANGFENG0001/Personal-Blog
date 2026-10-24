/**
 * Put a character's expression frames on ONE canvas.
 *
 * `build-pack.mjs` hard-fails when frames differ in size, and per-frame alpha
 * trimming always differs by a pixel or two (a hair wisp crosses the edge on
 * one frame and not the next). Rather than hand-nudging each frame, pad every
 * frame onto a shared canvas aligned **bottom-centre of the alpha bbox**: the
 * poses are identical except for the face, so that anchor is exact, and the
 * feet stay on the same baseline (which is what `anchors.baseline` reads).
 *
 * Usage: node skills/mascot-studio/scripts/align-frames.mjs <outDir> <name> <frame.png> ...
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [, , outDir, name, ...files] = process.argv;
if (!outDir || !name || files.length === 0) {
  console.error('用法：node skills/mascot-studio/scripts/align-frames.mjs <outDir> <name> <frame.png> ...');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const loaded = [];
for (const f of files) {
  const buf = await sharp(f).ensureAlpha().png().toBuffer();
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
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
  loaded.push({ f, buf, w, h, left, top, right, bottom });
}

const cw = Math.max(...loaded.map((l) => l.right - l.left + 1));
const ch = Math.max(...loaded.map((l) => l.bottom - l.top + 1));

for (const l of loaded) {
  const bw = l.right - l.left + 1;
  const bh = l.bottom - l.top + 1;
  // bottom-centre anchor: centre horizontally, flush to the bottom edge.
  const ox = Math.round((cw - bw) / 2);
  const oy = ch - bh;

  const figure = await sharp(l.buf)
    .extract({ left: l.left, top: l.top, width: bw, height: bh })
    .png()
    .toBuffer();

  const state = path.basename(l.f, '.png').replace(new RegExp(`^${name}-?`), '') || 'idle';
  const out = path.join(outDir, `${state || 'idle'}.png`);

  await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: figure, left: ox, top: oy }])
    .png()
    .toFile(out);

  console.log(`  ${(state || 'idle').padEnd(6)} ${bw}x${bh} → ${cw}x${ch}  (+${ox},+${oy})  ${out}`);
}
console.log(`✓ ${name}: ${loaded.length} 帧统一为 ${cw}x${ch}`);
