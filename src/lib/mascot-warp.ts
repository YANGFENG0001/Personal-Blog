/**
 * Per-part motion for photo/illustration mascot packs.
 *
 * A pack is a flat PNG, so parts cannot be split into layers — diffing an
 * "eyes only" regeneration against the base frame shows the model re-renders
 * shadows and line weight across 2% of the whole canvas, and any mask-based
 * split leaves a visible seam at the cut.
 *
 * So motion is applied as a *displacement field* instead: an SVG filter warps
 * the single bitmap, and because the field tapers to zero at the edges of every
 * region there is no seam to hide. Four regions are warped independently —
 * hair, head, torso, hem — each with its own amplitude, period and phase, so
 * they drift against each other the way a real figure does.
 *
 * The maps are drawn at runtime from the pack's anchors, so this works for any
 * pack without new assets or a format change.
 *
 * Reference: https://www.w3.org/TR/filter-effects/#feDisplacementMapElement
 * R channel = horizontal offset, G = vertical, 128 = no offset.
 */

/** Filter region padding, as a fraction of the element box (see FILTER_ATTRS). */
const PAD_X = 0.06;
const PAD_Y = 0.04;
/** Map resolution. The field is smooth, so a small map is indistinguishable. */
const MAP_W = 96;
const FILTER_ID = 'ms-warp';

export interface WarpOptions {
  /** Pack canvas size — only the aspect ratio matters. */
  width: number;
  height: number;
  /** Head centre, fraction of the canvas. */
  head: readonly [number, number];
  /** Feet line, fraction of the canvas height. */
  baseline: number;
  /** 0 disables, 1 is the tuned default. */
  intensity?: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a || 1e-6));
  return t * t * (3 - 2 * t);
};

type Field = (u: number, v: number) => readonly [number, number];

/**
 * Horizontal falloff: 1 within `inner` of the centre, easing to 0 at `outer`.
 * Must stay continuous — a hard cut anywhere in the field shows up as a crease
 * in the artwork, which is the exact thing this approach exists to avoid.
 */
const span = (u: number, centre: number, inner: number, outer: number) => 1 - smoothstep(inner, outer, Math.abs(u - centre));

/** Draw a field into a PNG data URI covering the padded filter region. */
function renderMap(w: number, h: number, field: Field): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    // Map pixel -> element-relative coordinate, undoing the filter padding.
    const v = ((y + 0.5) / h) * (1 + 2 * PAD_Y) - PAD_Y;
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * (1 + 2 * PAD_X) - PAD_X;
      const [dx, dy] = field(u, v);
      const o = (y * w + x) * 4;
      data[o] = 128 + Math.round(127 * Math.max(-1, Math.min(1, dx)));
      data[o + 1] = 128 + Math.round(127 * Math.max(-1, Math.min(1, dy)));
      data[o + 2] = 128;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Build the four fields. Everything is derived from the head anchor and the
 * baseline, so an arbitrary pack needs no hand-tuned regions.
 */
function buildFields(opts: WarpOptions): { name: string; field: Field }[] {
  const [hx, hy] = opts.head;
  const foot = Math.min(0.98, Math.max(0.6, opts.baseline));

  // Hair: a pendulum hanging from the crown. The field has to reach zero at
  // both ends of its span — roots are pinned by the scalp, and a hard edge at
  // the tips would crease the artwork — so the peak sits at mid-length.
  const hairTop = hy - 0.1;
  const hairBottom = Math.min(foot - 0.08, hy + 0.52);
  const hair: Field = (u, v) => {
    if (v < hairTop || v > hairBottom) return [0, 0];
    const p = (v - hairTop) / (hairBottom - hairTop);
    const along = Math.pow(Math.sin(Math.PI * p), 0.8);
    return [along * span(u, hx, 0.1, 0.3), 0];
  };

  // Head: a rotation rather than a slide — offset is proportional to the
  // distance from the head centre, so the crown and the chin move opposite ways.
  const headRy = 0.085;
  const headRx = 0.13;
  const head: Field = (u, v) => {
    const nx = (u - hx) / headRx;
    const ny = (v - hy - 0.01) / headRy;
    const w = 1 - smoothstep(0.55, 1, Math.hypot(nx, ny));
    if (w <= 0) return [0, 0];
    return [-ny * w, 0];
  };

  // Torso: breathing. Vertical, peaking at the chest, dead at the feet.
  const chestTop = hy + 0.13;
  const chestBottom = Math.min(foot, 0.94);
  const torso: Field = (u, v) => {
    if (v < chestTop || v > chestBottom) return [0, 0];
    const p = (v - chestTop) / (chestBottom - chestTop);
    const along = Math.sin(Math.PI * Math.min(1, p * 1.15));
    return [0, along * span(u, hx, 0.04, 0.2)];
  };

  // Hem: skirt / legs, the slowest follower. It has to stop well above the
  // shoes — a field that reaches the feet slides them across the floor, which
  // reads as the whole figure being dragged rather than as cloth moving.
  const hemTop = 0.58;
  const hemBottom = Math.max(hemTop + 0.08, foot - 0.12);
  const hem: Field = (u, v) => {
    if (v < hemTop || v > hemBottom) return [0, 0];
    const p = (v - hemTop) / (hemBottom - hemTop);
    const along = Math.pow(p, 1.3) * (1 - smoothstep(0.7, 1, p));
    return [along * span(u, hx, 0.05, 0.24), 0];
  };

  return [
    { name: 'hair', field: hair },
    { name: 'head', field: head },
    { name: 'torso', field: torso },
    { name: 'hem', field: hem },
  ];
}

/** Amplitude (fraction of the rendered width), period (s) and phase (rad). */
const RHYTHM: Record<string, { amp: number; period: number; phase: number }> = {
  hair: { amp: 0.026, period: 5.4, phase: 0 },
  head: { amp: 0.019, period: 7.2, phase: 0.9 },
  torso: { amp: 0.014, period: 4.8, phase: 1.9 },
  hem: { amp: 0.017, period: 5.9, phase: 2.6 },
};

export interface WarpHandle {
  start(): void;
  stop(): void;
  destroy(): void;
}

/**
 * How the filter gets attached:
 *  - `css`    — only sets `data-warp`; mascot.css supplies the whole filter
 *               chain, so the outline/shadow keep following the theme.
 *  - `inline` — writes `style.filter` itself, for previews that do not load
 *               mascot.css.
 */
export type WarpMode = 'css' | 'inline';

/**
 * Attach the warp filter to `target`. Returns null when the browser cannot
 * build it — callers should treat motion as optional.
 *
 * The filter element must exist in the document *before* the CSS references it:
 * a `filter: url(#…)` that fails to resolve makes the element disappear
 * entirely rather than degrade.
 */
export function attachWarp(target: HTMLElement, opts: WarpOptions, mode: WarpMode = 'css'): WarpHandle | null {
  if (typeof SVGElement === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') return null;
  if (!('createImageData' in CanvasRenderingContext2D.prototype)) return null;

  const intensity = opts.intensity ?? 1;
  if (intensity <= 0) return null;

  const aspect = (opts.width * (1 + 2 * PAD_X)) / (opts.height * (1 + 2 * PAD_Y));
  const mapH = Math.max(32, Math.round(MAP_W / aspect));
  const fields = buildFields(opts);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';

  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', FILTER_ID);
  filter.setAttribute('x', String(-PAD_X));
  filter.setAttribute('y', String(-PAD_Y));
  filter.setAttribute('width', String(1 + 2 * PAD_X));
  filter.setAttribute('height', String(1 + 2 * PAD_Y));
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const maps: SVGFEDisplacementMapElement[] = [];
  let input = 'SourceGraphic';
  fields.forEach((zone, i) => {
    const uri = renderMap(MAP_W, mapH, zone.field);
    if (!uri) return;
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
    image.setAttribute('href', uri);
    image.setAttribute('width', '100%');
    image.setAttribute('height', '100%');
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('result', `m${i}`);
    const disp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    // `in` must name the previous *result*, never the element id — chaining by
    // id silently drops the whole chain and the output becomes the map itself.
    disp.setAttribute('in', input);
    disp.setAttribute('in2', `m${i}`);
    disp.setAttribute('scale', '0');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', `s${i}`);
    filter.append(image, disp);
    maps.push(disp);
    input = `s${i}`;
  });
  if (!maps.length) return null;

  svg.append(filter);
  document.body.append(svg);

  // Width in CSS px, so the motion keeps its proportion at every mascot size.
  let width = target.getBoundingClientRect().width || 160;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { width = target.getBoundingClientRect().width || width; }) : null;
  ro?.observe(target);

  let raf = 0;
  let t0 = 0;
  let last = 0;
  const FRAME = 1000 / 30; // 30 fps is plenty for a smooth drift
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < FRAME) return;
    last = now;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    for (let i = 0; i < maps.length; i++) {
      const r = RHYTHM[fields[i]?.name ?? ''] ?? RHYTHM.hair!;
      const theta = (t / r.period) * Math.PI * 2 + r.phase;
      // Fundamental plus a little second harmonic: a pure sine reads mechanical.
      const wave = Math.sin(theta) * 0.8 + Math.sin(theta * 2 + 1.1) * 0.2;
      maps[i]!.setAttribute('scale', (r.amp * intensity * width * wave).toFixed(2));
    }
  };

  return {
    start() {
      if (raf) return;
      t0 = 0;
      last = 0;
      if (mode === 'inline') {
        // Keep whatever filter the element already had (e.g. a drop-shadow),
        // and put the displacement in front of it.
        const had = getComputedStyle(target).filter;
        target.style.filter = had && had !== 'none' ? `url(#${FILTER_ID}) ${had}` : `url(#${FILTER_ID})`;
      }
      target.dataset.warp = '1';
      raf = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      maps.forEach((m) => m.setAttribute('scale', '0'));
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      if (mode === 'inline') target.style.filter = '';
      delete target.dataset.warp;
      svg.remove();
    },
  };
}
