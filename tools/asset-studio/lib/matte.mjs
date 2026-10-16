/**
 * Background removal for character art, without any ML model.
 *
 * Works on raw RGBA buffers (Uint8Array/Buffer, 4 bytes per pixel) so it can be
 * unit-tested and reused. Handles the three cases image generators produce:
 *
 *  - "transparent": the image already has a real alpha channel → only cleanup.
 *  - "checker":     a fake transparency checkerboard painted into the pixels.
 *                   Removed by flood fill from the border PLUS enclosed regions
 *                   that look like checkerboard (two grey levels alternating
 *                   densely), so the holes between hair strands go too, while
 *                   plain white/grey areas of the character are kept.
 *  - "solid":       a flat backdrop (#00FF00 green screen, white, …) → chroma key
 *                   with spill suppression.
 *
 * Edges get a real alpha estimate (observed = a·F + (1−a)·B) and colour
 * decontamination, so no grey/white fringe is left around hair.
 */

const lumOf = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
const satOf = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
const dist2 = (d, i, c) => (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2;

/** Indices of pixels in a border band `band` px wide. */
function borderPixels(w, h, band) {
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < band || y < band || x >= w - band || y >= h - band) out.push(y * w + x);
    }
  }
  return out;
}

/** Two-means on a list of numbers. */
function twoMeans(values) {
  let a = Math.min(...values);
  let b = Math.max(...values);
  for (let it = 0; it < 12; it++) {
    let sa = 0, na = 0, sb = 0, nb = 0;
    for (const v of values) {
      if (Math.abs(v - a) <= Math.abs(v - b)) { sa += v; na++; } else { sb += v; nb++; }
    }
    a = na ? sa / na : a;
    b = nb ? sb / nb : b;
  }
  let na = 0;
  for (const v of values) if (Math.abs(v - a) <= Math.abs(v - b)) na++;
  return { a, b, fa: na / values.length, fb: 1 - na / values.length };
}

/**
 * Classify the background.
 * @returns {{kind:'transparent'|'checker'|'solid'|'complex', light?:number, dark?:number, color?:number[], confidence:number}}
 */
export function analyze(d, w, h) {
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  const px = borderPixels(w, h, band);
  let clear = 0;
  for (const p of px) if (d[p * 4 + 3] < 16) clear++;
  if (clear / px.length > 0.6) return { kind: 'transparent', confidence: clear / px.length };

  // Judge each side separately: the character often touches one or two edges,
  // so the background is read from the cleanest sides only.
  const sides = [
    Array.from({ length: w * band }, (_, k) => (k % band) * w + ((k / band) | 0)), // top rows
    Array.from({ length: w * band }, (_, k) => (h - 1 - (k % band)) * w + ((k / band) | 0)), // bottom
    Array.from({ length: h * band }, (_, k) => ((k / band) | 0) * w + (k % band)), // left
    Array.from({ length: h * band }, (_, k) => ((k / band) | 0) * w + (w - 1 - (k % band))), // right
  ];
  const neutralShare = (list) => list.filter((p) => satOf(d, p * 4) <= 14).length / list.length;
  const ranked = sides.map((list) => ({ list, n: neutralShare(list) })).sort((x, y) => y.n - x.n);
  const clean = ranked.filter((r, i) => i < 2 || r.n > 0.9).flatMap((r) => r.list);

  const lums = [];
  let neutral = 0;
  for (const p of clean) {
    const i = p * 4;
    // Checker cells are light greys; dark neutral pixels (black hair, ink) belong to the art.
    if (satOf(d, i) <= 14 && lumOf(d, i) >= 100) { neutral++; lums.push(lumOf(d, i)); }
  }
  if (neutral / clean.length > 0.8 && lums.length) {
    const m = twoMeans(lums);
    // Alternation along the cleanest side: a checkerboard flips every cell.
    const line = ranked[0].list.filter((_, k) => k % band === 0);
    let flips = 0;
    let prev = -1;
    for (const p of line) {
      const l = lumOf(d, p * 4);
      const c = Math.abs(l - m.a) <= Math.abs(l - m.b) ? 0 : 1;
      if (prev !== -1 && c !== prev) flips++;
      prev = c;
    }
    const isChecker = Math.abs(m.b - m.a) >= 6 && Math.min(m.fa, m.fb) > 0.12 && flips / line.length > 1 / 48;
    if (isChecker) {
      return { kind: 'checker', light: Math.max(m.a, m.b), dark: Math.min(m.a, m.b), confidence: neutral / clean.length };
    }
  }

  // Dominant colour on the clean sides?
  const mean = [0, 0, 0];
  for (const p of clean) { mean[0] += d[p * 4]; mean[1] += d[p * 4 + 1]; mean[2] += d[p * 4 + 2]; }
  mean[0] /= clean.length; mean[1] /= clean.length; mean[2] /= clean.length;
  let near = 0;
  for (const p of clean) if (dist2(d, p * 4, mean) < 40 * 40) near++;
  if (near / clean.length > 0.85) return { kind: 'solid', color: mean.map(Math.round), confidence: near / clean.length };
  return { kind: 'complex', confidence: 1 - near / clean.length };
}

/**
 * Build a background mask (1 = background).
 * @param {object} info result of analyze()
 * @param {{tolerance?:number, holes?:boolean, minHole?:number}} opt
 */
export function backgroundMask(d, w, h, info, opt = {}) {
  const N = w * h;
  const mask = new Uint8Array(N);
  if (info.kind === 'transparent') {
    for (let p = 0; p < N; p++) mask[p] = d[p * 4 + 3] < 8 ? 1 : 0;
    return mask;
  }
  if (info.kind === 'complex') return mask;

  const tol = opt.tolerance ?? (info.kind === 'checker' ? 18 : 42);
  // cls: 0 = not a candidate, 1 = light checker / key, 2 = dark checker
  const cls = new Uint8Array(N);
  if (info.kind === 'checker') {
    for (let p = 0; p < N; p++) {
      const i = p * 4;
      if (satOf(d, i) > tol) continue;
      const l = lumOf(d, i);
      if (l < info.dark - tol || l > info.light + tol) continue;
      cls[p] = Math.abs(l - info.light) <= Math.abs(l - info.dark) ? 1 : 2;
    }
  } else {
    const t2 = tol * tol;
    for (let p = 0; p < N; p++) if (dist2(d, p * 4, info.color) <= t2) cls[p] = 1;
  }

  // 1) Flood fill from the border through candidates.
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const seed = (p) => { if (cls[p] && !mask[p]) { mask[p] = 1; queue[tail++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < N - w) seed(p + w);
  }

  // 2) Enclosed regions (gaps between hair strands, under arms…).
  const keySaturated = info.kind === 'solid' && Math.max(...info.color) - Math.min(...info.color) > 60;
  const holes = opt.holes ?? (info.kind === 'checker' || keySaturated);
  if (holes) {
    const minHole = opt.minHole ?? Math.max(24, Math.round(N * 0.00003));
    const seen = new Uint8Array(N);
    const comp = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (!cls[s] || mask[s] || seen[s]) continue;
      let n = 0, a = 0, b = 0, flips = 0, ch = 0, ct = 0;
      seen[s] = 1;
      comp[ct++] = s;
      while (ch < ct) {
        const p = comp[ch++];
        n++;
        if (cls[p] === 1) a++; else b++;
        const x = p % w;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1];
        for (const q of nb) {
          if (q < 0 || !cls[q] || mask[q]) continue;
          if (cls[q] !== cls[p]) flips++;
          if (!seen[q]) { seen[q] = 1; comp[ct++] = q; }
        }
      }
      let accept;
      if (info.kind === 'checker') {
        // Real checkerboard: both grey levels present and they alternate densely.
        accept = n >= minHole && Math.min(a, b) / n > 0.12 && flips / n > 0.015;
      } else {
        accept = n >= minHole;
      }
      if (accept) for (let k = 0; k < ct; k++) mask[comp[k]] = 1;
    }
  }
  return mask;
}

/** Remove isolated foreground specks (stray dots left from the backdrop). */
export function despeckle(mask, w, h, minSize) {
  const N = w * h;
  const min = minSize ?? Math.max(48, Math.round(N * 0.00008));
  const seen = new Uint8Array(N);
  const comp = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (mask[s] || seen[s]) continue;
    let ch = 0, ct = 0;
    seen[s] = 1;
    comp[ct++] = s;
    while (ch < ct && ct < min) {
      const p = comp[ch++];
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
        if (q >= 0 && !mask[q] && !seen[q]) { seen[q] = 1; comp[ct++] = q; }
      }
    }
    if (ct < min) {
      // finish the component to mark all of it, then drop it
      while (ch < ct) {
        const p = comp[ch++];
        const x = p % w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
          if (q >= 0 && !mask[q] && !seen[q]) { seen[q] = 1; comp[ct++] = q; }
        }
      }
      if (ct < min) for (let k = 0; k < ct; k++) mask[comp[k]] = 1;
    } else {
      // big component: mark the rest as seen without collecting
      const stack = comp.subarray(ch, ct);
      const rest = Array.from(stack);
      while (rest.length) {
        const p = rest.pop();
        const x = p % w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
          if (q >= 0 && !mask[q] && !seen[q]) { seen[q] = 1; rest.push(q); }
        }
      }
    }
  }
  return mask;
}

/**
 * Turn a hard mask into a soft alpha and decontaminate edge colours.
 * Writes into `d` in place (RGB and A).
 * @param {(i:number)=>number[]} bgAt expected background colour for a pixel index
 */
export function refineEdges(d, w, h, mask, bgAt, opt = {}) {
  const N = w * h;
  const r = opt.radius ?? 2;
  const out = new Uint8ClampedArray(N);
  for (let p = 0; p < N; p++) out[p] = mask[p] ? 0 : 255;

  // edge band: foreground pixels with a background pixel within r
  const isEdge = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (mask[p]) continue;
    const x = p % w, y = (p / w) | 0;
    search: for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (mask[yy * w + xx]) { isEdge[p] = 1; break search; }
      }
    }
  }

  const R = r + 2;
  for (let p = 0; p < N; p++) {
    if (!isEdge[p]) continue;
    const x = p % w, y = (p / w) | 0;
    const i = p * 4;
    // nearest background pixel's original colour, and the mean of solid foreground nearby
    let best = Infinity, B = null;
    let fr = 0, fg = 0, fb = 0, fn = 0;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (mask[q]) {
          const dd = dx * dx + dy * dy;
          if (dd < best) { best = dd; B = q; }
        } else if (!isEdge[q]) {
          fr += d[q * 4]; fg += d[q * 4 + 1]; fb += d[q * 4 + 2]; fn++;
        }
      }
    }
    const bg = bgAt(B ?? p);
    if (!fn) {
      // thin feature (a hair strand): judge by contrast with the background only
      const c = Math.sqrt(dist2(d, i, bg));
      out[p] = Math.max(0, Math.min(255, Math.round((c / 90) * 255)));
      continue;
    }
    const F = [fr / fn, fg / fn, fb / fn];
    const fbx = F[0] - bg[0], fby = F[1] - bg[1], fbz = F[2] - bg[2];
    const den = fbx * fbx + fby * fby + fbz * fbz;
    if (den < 400) continue; // foreground ≈ background colour: cannot separate, keep opaque
    let a = ((d[i] - bg[0]) * fbx + (d[i + 1] - bg[1]) * fby + (d[i + 2] - bg[2]) * fbz) / den;
    a = Math.max(0, Math.min(1, a));
    out[p] = Math.round(a * 255);
    if (a > 0.02 && a < 0.98) {
      // un-mix the background from the colour
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round(bg[k] + (d[i + k] - bg[k]) / a)));
    }
  }
  if (opt.feather) {
    const tmp = Uint8ClampedArray.from(out);
    for (let p = 0; p < N; p++) {
      if (!isEdge[p]) continue;
      const x = p % w, y = (p / w) | 0;
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        s += tmp[yy * w + xx]; n++;
      }
      out[p] = Math.round(s / n);
    }
  }
  for (let p = 0; p < N; p++) d[p * 4 + 3] = Math.min(d[p * 4 + 3], out[p]);
  return d;
}

/** Suppress green/magenta key spill on semi-transparent and edge pixels. */
export function despill(d, w, h, key) {
  const N = w * h;
  const gKey = key[1] > key[0] + 60 && key[1] > key[2] + 60;
  const mKey = key[0] > key[1] + 60 && key[2] > key[1] + 60;
  if (!gKey && !mKey) return d;
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    if (gKey) d[i + 1] = Math.min(d[i + 1], Math.max(d[i], d[i + 2]) + 6);
    if (mKey) { const lim = d[i + 1] + 6; d[i] = Math.min(d[i], Math.max(lim, d[i + 2] * 0 + lim)); d[i + 2] = Math.min(d[i + 2], lim); }
  }
  return d;
}

/** Function giving the expected background colour at a pixel (for edge refinement). */
export function backgroundSampler(d, info) {
  if (info.kind === 'solid') return () => info.color;
  if (info.kind === 'checker') {
    return (p) => {
      const l = lumOf(d, p * 4);
      const v = Math.abs(l - info.light) <= Math.abs(l - info.dark) ? info.light : info.dark;
      return [v, v, v];
    };
  }
  return (p) => [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]];
}

/**
 * Full algorithmic pipeline. Returns a new RGBA buffer plus what was detected.
 * @param {{tolerance?:number, holes?:boolean, feather?:boolean, despeckle?:boolean, kind?:string, color?:number[]}} opt
 */
export function removeBackground(src, w, h, opt = {}) {
  const d = Uint8ClampedArray.from(src);
  let info = analyze(d, w, h);
  if (opt.kind === 'solid' && opt.color) info = { kind: 'solid', color: opt.color, confidence: 1 };
  if (info.kind === 'complex') return { data: d, info, removed: 0 };
  const mask = backgroundMask(d, w, h, info, opt);
  if (opt.despeckle !== false) despeckle(mask, w, h);
  if (info.kind !== 'transparent') {
    refineEdges(d, w, h, mask, backgroundSampler(src, info), { feather: opt.feather ?? true });
    if (info.kind === 'solid') despill(d, w, h, info.color);
  } else {
    for (let p = 0; p < w * h; p++) if (mask[p]) d[p * 4 + 3] = 0;
  }
  let removed = 0;
  for (let p = 0; p < w * h; p++) if (d[p * 4 + 3] === 0) removed++;
  return { data: d, info, removed: removed / (w * h) };
}

/** Combine an ML alpha mask (0..255 per pixel) with the algorithmic result: keep the smaller alpha. */
export function intersectAlpha(d, alpha) {
  for (let p = 0; p < alpha.length; p++) d[p * 4 + 3] = Math.min(d[p * 4 + 3], alpha[p]);
  return d;
}

/**
 * Bounding box of visible pixels and character anchors, as fractions of the
 * cropped box: baseline (feet / bottom edge), head (centre of the top of the
 * figure) and a suggested speech-bubble point.
 */
export function measure(d, w, h, threshold = 12) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // head: centroid of the top 16% of the figure
  const band = Math.max(1, Math.round(bh * 0.16));
  let sx = 0, n = 0;
  for (let y = y0; y < y0 + band; y++) {
    for (let x = x0; x <= x1; x++) if (d[(y * w + x) * 4 + 3] > threshold) { sx += x; n++; }
  }
  const hx = n ? (sx / n - x0) / bw : 0.5;
  const head = [round3(hx), round3(band * 0.55 / bh)];
  return {
    box: { x: x0, y: y0, width: bw, height: bh },
    anchors: { baseline: 1, head, bubble: [round3(hx < 0.5 ? Math.min(0.95, hx + 0.18) : Math.max(0.05, hx - 0.18)), 0.02] },
  };
}

const round3 = (v) => Math.round(v * 1000) / 1000;
