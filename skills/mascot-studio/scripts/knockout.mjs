/**
 * Knock a flat white background out of an AI-generated figure sheet.
 *
 *   node .ref/knockout.mjs <in.png> <out.png>
 *
 * Why not just "make white transparent": the eyes are white, the highlights on
 * the dress are white, and a threshold pass punches holes in all of them. So
 * the background is found by flood-filling *from the border*, which only ever
 * reaches white that is connected to the outside of the figure. Interior white
 * is unreachable and survives.
 *
 * The flood fill leaves a one-pixel rim of half-white anti-aliasing, which on a
 * pale page reads as a halo. Those rim pixels get their alpha from their own
 * luminance instead of being either kept or dropped.
 */
import sharp from 'sharp';

const [, , src, out] = process.argv;
if (!src || !out) {
  console.error('用法：node knockout.mjs <in.png> <out.png>');
  process.exit(1);
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const N = W * H;
const px = new Uint8Array(data);

/* "White enough to be background" is deliberately strict — 246, not 240. The
   dress is a saturated blue, so there is nothing near the threshold inside the
   figure; being strict just means the rim is handled by the alpha ramp below
   rather than being swallowed whole. */
const WHITE = 246;
const isBg = (i) => px[i * 4] >= WHITE && px[i * 4 + 1] >= WHITE && px[i * 4 + 2] >= WHITE;

const seen = new Uint8Array(N);
const stack = new Int32Array(N);
let sp = 0;
const push = (i) => {
  if (i < 0 || i >= N || seen[i]) return;
  if (!isBg(i)) return;
  seen[i] = 1;
  stack[sp++] = i;
};

for (let x = 0; x < W; x++) {
  push(x);
  push((H - 1) * W + x);
}
for (let y = 0; y < H; y++) {
  push(y * W);
  push(y * W + W - 1);
}

while (sp > 0) {
  const i = stack[--sp];
  const x = i % W;
  const y = (i / W) | 0;
  if (x > 0) push(i - 1);
  if (x < W - 1) push(i + 1);
  if (y > 0) push(i - W);
  if (y < H - 1) push(i + W);
}

let cleared = 0;
for (let i = 0; i < N; i++) {
  if (seen[i]) {
    px[i * 4 + 3] = 0;
    cleared++;
  }
}

/* The rim: pixels that survived the fill but are almost white. Their alpha is
   read off their own luminance so a 40%-covered pixel keeps 40%. */
const RIM_HI = 250;
const RIM_LO = 226;
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (seen[i]) continue;
    let touches = false;
    if (seen[i - 1] || seen[i + 1] || seen[i - W] || seen[i + W]) touches = true;
    if (!touches) continue;
    const o = i * 4;
    const lum = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
    if (lum <= RIM_LO) continue;
    const a = Math.max(0, Math.min(255, Math.round((255 * (RIM_HI - lum)) / (RIM_HI - RIM_LO))));
    if (a < px[o + 3]) px[o + 3] = a;
  }
}

await sharp(Buffer.from(px), { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
console.log(`ok  ${W}x${H}  cleared ${((cleared / N) * 100).toFixed(1)}%  -> ${out}`);
