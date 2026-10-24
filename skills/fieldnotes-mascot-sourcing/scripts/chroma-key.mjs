/**
 * Chroma-key a flat-backdrop character render into a transparent PNG.
 *
 * The model never returns real alpha (`background: transparent` just paints a
 * checkerboard), so every frame is generated on a flat backdrop and keyed here.
 *
 * v2 — the magenta-ness metric (min(R,B) - G) from v1 was too weak when the
 * model drifted off pure magenta (蕾西亚 came back on a maroon 132,54,86
 * backdrop: metric 32, ramp 6..20, which ate pale lavender hair). Now we key on
 * **RGB distance from the sampled backdrop colour**, which behaves the same for
 * magenta, pink, maroon or grey, then un-premultiply the fringe so the backdrop
 * colour is mathematically removed instead of merely desaturated.
 *
 * Usage: node skills/fieldnotes-mascot-sourcing/scripts/chroma-key.mjs <in.png> <out.png> [--check] [--drop-islands]
 *   --check  composite on mid-grey so fringing is obvious
 */
import sharp from 'sharp';

const [, , input, output, ...flags] = process.argv;
if (!input || !output) {
  console.error('用法：node skills/fieldnotes-mascot-sourcing/scripts/chroma-key.mjs <in.png> <out.png> [--check] [--drop-islands]');
  process.exit(1);
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

/* ---------------------------------------------------- sample the backdrop */

// Median of a 2px border ring — more stable than four corner pixels when the
// generator puts a vignette or a stray stroke in one corner.
const ring = [];
const at = (x, y) => {
  const o = (y * W + x) * 4;
  return [data[o], data[o + 1], data[o + 2]];
};
const push = (x, y) => ring.push(at(x, y));
for (let x = 0; x < W; x += 3) {
  push(x, 0); push(x, 1); push(x, H - 1); push(x, H - 2);
}
for (let y = 0; y < H; y += 3) {
  push(0, y); push(1, y); push(W - 1, y); push(W - 2, y);
}
const median = (arr) => arr.sort((a, b) => a - b)[arr.length >> 1];
const B = [0, 1, 2].map((c) => median(ring.map((p) => p[c])));

const dist = (r, g, b) => Math.sqrt((r - B[0]) ** 2 + (g - B[1]) ** 2 + (b - B[2]) ** 2);

// How far the backdrop itself wanders from its own median → the noise floor.
// Sample only TL / TR / BL corner patches, for two reasons:
//  - the figure can touch the middle of an edge (long hair, a raised arm), and a
//    single contaminated edge pixel used to push the floor to 130, which dragged
//    the whole figure into the soft ramp and turned lavender hair mint green;
//  - the bottom-right corner is where the generator stamps its watermark, and
//    that white text pushed the floor to the 45 ceiling on its own.
// Use the p95 rather than the max so one stray speck cannot set the threshold.
const P = Math.min(28, W >> 4, H >> 4);
const cornerD = [];
for (const [cx, cy] of [[0, 0], [W - P, 0], [0, H - P]]) {
  for (let y = cy; y < cy + P; y += 2) {
    for (let x = cx; x < cx + P; x += 2) cornerD.push(dist(...at(x, y)));
  }
}
cornerD.sort((a, b) => a - b);
// The backdrop is never perfectly flat (this generator drifts ~±15 per channel
// across the canvas), so the transparent floor has to clear the WHOLE drift,
// not its p95 — otherwise the far side of the gradient stays faintly opaque and
// the figure never trims. Max over the three watermark-free corners, plus margin.
const noise = cornerD[cornerD.length - 1] ?? 0;
// Cel-shaded art has crisp edges, so the ramp is deliberately NARROW (16 levels).
// A wide ramp left a magenta halo: every edge pixel sat mid-ramp, the
// un-premultiply only partially recovered it, and the residue showed as pink.
const lo = Math.min(110, Math.max(6, noise * 1.2 + 4));
const hi = lo + 16;

/* -------------------------------------------------------------- soft matte */

const wmW = Math.round(W * 0.3);
const wmH = Math.round(H * 0.075);

const out = Buffer.alloc(data.length);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const d = dist(r, g, b);

    // Close to the backdrop colour → transparent; far from it → the figure.
    let a = d <= lo ? 0 : d >= hi ? 255 : Math.round(((d - lo) / (hi - lo)) * 255);
    // Kill the watermark block outright; the figure never reaches that corner.
    if (x > W - wmW && y > H - wmH) a = 0;

    let nr = r, ng = g, nb = b;
    if (a > 0 && a < 255) {
      // Un-premultiply: observed = a*F + (1-a)*B  ⇒  F = (C - (1-a)B) / a
      const k = 1 - a / 255;
      nr = Math.min(255, Math.max(0, (r - B[0] * k) / (a / 255)));
      ng = Math.min(255, Math.max(0, (g - B[1] * k) / (a / 255)));
      nb = Math.min(255, Math.max(0, (b - B[2] * k) / (a / 255)));
      // Belt and braces: if the recovered pixel still leans magenta (R and B
      // both above G), pull them back toward G. Un-premultiply alone leaves a
      // visible pink rim on pale hair when alpha is slightly underestimated.
      const m = Math.min(nr, nb) - ng;
      if (m > 10) {
        const pull = Math.min(0.85, m / 120);
        nr -= (nr - ng) * pull;
        nb -= (nb - ng) * pull;
      }
    }

    out[o] = nr; out[o + 1] = ng; out[o + 2] = nb; out[o + 3] = a;
  }
}

/* ------------------------------------------------- drop floating islands */

// The generator sometimes adds a detached prop (蕾西亚 came with a black
// holographic slab floating beside her head). A blind bbox erase would punch a
// hole in the hair that passes through the same columns, so drop it by
// connected component instead: keep the figure, discard small islands.
if (flags.includes('--drop-islands')) {
  const seen = new Uint8Array(W * H);
  const comps = [];
  const stack = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (seen[i] || out[i * 4 + 3] <= 32) continue;
      const pix = [];
      stack.length = 0; stack.push(i); seen[i] = 1;
      while (stack.length) {
        const j = stack.pop();
        pix.push(j);
        const jx = j % W, jy = (j - jx) / W;
        for (const [nx, ny] of [[jx - 1, jy], [jx + 1, jy], [jx, jy - 1], [jx, jy + 1]]) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (!seen[k] && out[k * 4 + 3] > 32) { seen[k] = 1; stack.push(k); }
        }
      }
      comps.push(pix);
    }
  }
  comps.sort((a, b) => b.length - a.length);
  const keep = comps[0]?.length ?? 0;
  const dropped = comps.slice(1).filter((c) => c.length < keep * 0.1);
  for (const c of dropped) for (const j of c) out[j * 4 + 3] = 0;
  if (dropped.length) {
    console.log(`  --drop-islands: 剔除 ${dropped.length} 个碎片（最大 ${dropped[0].length}px，主体 ${keep}px）`);
  }
}

/* ------------------------------------------------------- trim to the figure */

// sharp's trim() silently gives up when one semi-opaque pixel touches an edge
// (a clear umbrella does exactly that), so compute the bbox ourselves.
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (out[(y * W + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
}
if (x1 < x0) {
  console.error('✗ 整张图都是透明的，检查背景色采样');
  process.exit(1);
}
const pad = 4;
const box = flags.includes('--no-trim')
  ? { left: 0, top: 0, width: W, height: H }
  : {
      left: Math.max(0, x0 - pad),
      top: Math.max(0, y0 - pad),
      width: Math.min(W, x1 + pad + 1) - Math.max(0, x0 - pad),
      height: Math.min(H, y1 + pad + 1) - Math.max(0, y0 - pad),
    };

const trimmed = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .extract(box)
  .png()
  .toBuffer({ resolveWithObject: true });

let opaque = 0;
for (let i = 3; i < out.length; i += 4) if (out[i] > 200) opaque++;

console.log(
  JSON.stringify({
    in: input.split(/[\\/]/).pop(),
    bg: B.join(','),
    ramp: `${lo.toFixed(1)}..${hi.toFixed(1)}`,
    size: `${trimmed.info.width}x${trimmed.info.height}`,
    opaquePct: +((opaque / (W * H)) * 100).toFixed(1),
  })
);

if (flags.includes('--check')) {
  await sharp(trimmed.data).flatten({ background: '#9aa0aa' }).toFile(output);
} else {
  await sharp(trimmed.data).toFile(output);
}
