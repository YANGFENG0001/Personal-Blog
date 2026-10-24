#!/usr/bin/env node
/**
 * Build displacement maps for per-part motion on a single flat illustration.
 *
 * Why this exists
 * ---------------
 * The obvious way to animate "each part separately" is layered sprites (eyes /
 * hair / body as separate images). With AI-generated art that does NOT work:
 * asking the model to change only the eyes still re-renders shadows and line
 * weights everywhere, so a frame diff spreads over the whole figure (measured:
 * 2.14% of all pixels) and you cannot cut a clean layer out of it.
 *
 * A displacement map sidesteps the problem: it warps the *actual pixels* of one
 * frame, so there is no seam and no ghosting. Areas where the map is neutral
 * (128) do not move at all, which is what makes the motion local.
 *
 * Output
 * ------
 * One grayscale-ish PNG per zone, same pixel size as the art:
 *   R = horizontal offset   (128 = none, <128 = left,  >128 = right)
 *   G = vertical offset     (128 = none, <128 = up,    >128 = down)
 *   B = unused (0)
 * Feed it to <feDisplacementMap> and animate the `scale` attribute.
 *
 * Usage
 * -----
 *   node warp-map.mjs warp.config.json
 *
 * Config
 * ------
 * {
 *   "width": 350, "height": 900, "out": "warp",     // writes warp-<id>.png
 *   "zones": [
 *     { "id": "hair", "shape": "sides", "y": [0.02, 0.55], "edge": 2.6,
 *       "axis": "x", "amp": 1,   "center": 0.5 },
 *     { "id": "body", "shape": "band",  "y": [0.3, 1], "axis": "y", "amp": 0.35 },
 *     { "id": "head", "shape": "ellipse", "cx": 0.5, "cy": 0.13,
 *       "rx": 0.16, "ry": 0.1, "axis": "x", "amp": 1 }
 *   ]
 * }
 *
 *   shape   band    — whole width, feathered at the top and bottom of `y`
 *           sides   — like band, but the effect grows toward the left/right
 *                     edges (`edge` = how fast; 2.6 ≈ full strength by 30% out)
 *           ellipse — soft radial blob, for a head/torso that tilts as a unit
 *   axis    x | y | both
 *   amp     0..1 strength; 1 fills the channel (64 levels of headroom is plenty,
 *           the filter's own `scale` decides the final pixel amplitude)
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error('用法：node warp-map.mjs <warp.config.json>');
  process.exit(1);
}
const cfgFile = path.resolve(cfgPath);
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const baseDir = path.dirname(cfgFile);

const W = Number(cfg.width);
const H = Number(cfg.height);
if (!Number.isFinite(W) || !Number.isFinite(H)) {
  console.error('✗ 缺少 width / height');
  process.exit(1);
}
const outPrefix = path.resolve(baseDir, cfg.out ?? 'warp');
fs.mkdirSync(path.dirname(outPrefix), { recursive: true });

const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Smooth 0→1→0 across a band, so the motion fades in instead of popping. */
const bandFalloff = (t, [a, b]) => {
  if (t < a || t > b) return 0;
  const p = (t - a) / (b - a || 1);
  return Math.sin(Math.PI * p);
};

const AXIS = 64; // headroom in the channel

for (const z of cfg.zones ?? []) {
  if (!z.id) {
    console.error('✗ 每个 zone 需要 id');
    process.exit(1);
  }
  const amp = Number(z.amp ?? 1);
  const axis = z.axis ?? 'x';
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    const ty = y / H;
    for (let x = 0; x < W; x++) {
      const tx = x / W;
      let k = 0;

      if (z.shape === 'band' || z.shape === 'sides' || z.shape === undefined) {
        k = bandFalloff(ty, z.y ?? [0, 1]);
        if (z.shape === 'sides') {
          const c = z.center ?? 0.5;
          const edge = Number(z.edge ?? 2.6);
          k *= clamp01(Math.abs(tx - c) * edge);
        }
      } else if (z.shape === 'ellipse') {
        const dx = (tx - (z.cx ?? 0.5)) / (z.rx ?? 0.2);
        const dy = (ty - (z.cy ?? 0.5)) / (z.ry ?? 0.2);
        const r = Math.hypot(dx, dy);
        k = r >= 1 ? 0 : Math.cos((r * Math.PI) / 2) ** 2;
      } else {
        console.error(`✗ 未知 shape：${z.shape}`);
        process.exit(1);
      }

      k = clamp01(k * amp);
      const d = Math.round(AXIS * k);
      const o = (y * W + x) * 4;
      buf[o] = axis === 'y' ? 128 : 128 + d;
      buf[o + 1] = axis === 'x' ? 128 : 128 + d;
      buf[o + 2] = 0;
      buf[o + 3] = 255;
    }
  }

  const out = `${outPrefix}-${z.id}.png`;
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`✓ ${out}  ${W}x${H}  axis=${axis}  amp=${amp}  ${kb}KB`);
}

console.log('');
console.log('下一步：在 <filter> 里这样用（scale 由 SMIL 或 JS 动画，单位是像素）：');
console.log('  <feImage href="warp-hair.png" result="m"/>');
console.log('  <feDisplacementMap in="SourceGraphic" in2="m" scale="0" xChannelSelector="R" yChannelSelector="G">');
console.log('    <animate attributeName="scale" values="-6;6;-6" dur="5.2s" repeatCount="indefinite"/>');
console.log('  </feDisplacementMap>');
console.log('多个 zone 串联即可，每条用不同的 dur，相位自然错开：');
console.log('  <feDisplacementMap in="prev" in2="m2" .../>');
