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
 * Build the displacement fields. Everything is derived from the head anchor and
 * the baseline, so an arbitrary pack needs no hand-tuned regions.
 *
 * Five zones. A "hem" zone was tried and removed: it slides whatever is down
 * there sideways, which reads as the legs skating across the floor on a
 * character in a bodysuit. Anything below the hips is left alone.
 *
 * The hard constraint shaping all of this: a field is a function of (u, v)
 * only, so it cannot tell hair from the arm behind it — they occupy the same
 * columns. That is why the hair zone stops at the shoulders instead of running
 * down the full length of the hair. The same constraint is why there is no
 * wrist or elbow zone: a pack has no joint anchors, so "the hand" is a guess
 * about a column range, and a guessed hand that drifts is worse than a hand
 * that does not.
 */
function buildFields(opts: WarpOptions): { name: string; field: Field }[] {
  const [hx, hy] = opts.head;
  const foot = Math.min(0.98, Math.max(0.6, opts.baseline));

  // Head: a turn about the neck, not a slide and not a spin about the head's
  // own centre. Pivoting at the neck is what makes the crown travel while the
  // jaw stays put; a centre pivot swings the chin as far as the crown, which
  // reads as the head being sheared sideways.
  const headRx = 0.115;
  const headRy = 0.08;
  const pivotY = hy + 0.045;
  const head: Field = (u, v) => {
    const nx = (u - hx) / headRx;
    const ny = (v - pivotY) / headRy;
    const w = 1 - smoothstep(0.92, 1.45, Math.hypot(nx, ny));
    if (w <= 0) return [0, 0];
    return [-Math.max(-1.3, Math.min(1.3, ny)) * w, 0];
  };

  // Hair: the mass beside the head lags the turn. Zero down the centre line —
  // the face must not slide — and full strength from about a third of a head
  // width outwards. The span ends at the shoulders because below that the arms
  // sit in the same columns.
  const hairTop = hy - 0.055;
  const hairBottom = Math.min(foot - 0.5, hy + 0.2);
  const hair: Field = (u, v) => {
    if (v < hairTop || v > hairBottom) return [0, 0];
    const p = (v - hairTop) / (hairBottom - hairTop);
    const along = Math.pow(Math.sin(Math.PI * p), 0.65);
    const side = smoothstep(0.045, 0.145, Math.abs(u - hx));
    return [along * side, 0];
  };

  // Neck: a pure lateral drift across the whole band, tapered top and bottom.
  //
  // This is the zone that makes the head look *carried*. The head field above
  // already rotates, but rotation alone swings the head on an arc, and an arc
  // still reads as a stick with a ball on it. Translating the neck band on its
  // own, slower phase is what a real neck does under a heavy head — and it is
  // the one thing a flat pack can do that a joint-less image otherwise cannot.
  const neckTop = hy + 0.015;
  const neckBottom = hy + 0.145;
  const neck: Field = (_u, v) => {
    if (v < neckTop || v > neckBottom) return [0, 0];
    const p = (v - neckTop) / (neckBottom - neckTop);
    return [Math.sin(Math.PI * p), 0];
  };

  // Torso: breathing. Vertical, peaking at the chest, stopped at the waist —
  // running it down to the hips lifts the pelvis off the legs, which reads as
  // the waist stretching rather than as a breath.
  const chestTop = hy + 0.13;
  const chestBottom = Math.min(foot - 0.3, hy + 0.45);
  const torso: Field = (u, v) => {
    if (v < chestTop || v > chestBottom) return [0, 0];
    const p = (v - chestTop) / (chestBottom - chestTop);
    const along = Math.sin(Math.PI * Math.min(1, p * 1.15));
    return [0, along * span(u, hx, 0.04, 0.2)];
  };

  // Bust: the mass on the ribcage, so it lags the breath on both axes. Same
  // period as `torso` on purpose — a different period would read as two
  // unrelated things wobbling, which is exactly what the head/hair pair is
  // arranged to avoid. The lag comes from the phase, not from the frequency.
  const bustTop = hy + 0.185;
  const bustBottom = Math.min(foot - 0.34, hy + 0.4);
  const bust: Field = (_u, v) => {
    if (v < bustTop || v > bustBottom) return [0, 0];
    const p = (v - bustTop) / (bustBottom - bustTop);
    const along = Math.sin(Math.PI * p);
    return [along * 0.7, along * 0.35];
  };

  return [
    { name: 'head', field: head },
    { name: 'hair', field: hair },
    { name: 'neck', field: neck },
    { name: 'torso', field: torso },
    { name: 'bust', field: bust },
  ];
}

/**
 * Amplitude (fraction of the rendered width), period (s) and phase (rad).
 *
 * Head and hair share a period so the hair is always *behind* the turn rather
 * than drifting independently of it — independent periods read as two unrelated
 * things wobbling, which is the opposite of the parts working together.
 *
 * That period is 7 s because the stylesheet's whole-body sway is 7 s. Matching
 * it makes the body, the head and the hair one gesture with a little follow
 * through, instead of the figure swaying while the head does its own thing.
 * Breathing keeps 4.8 s, matching the stylesheet's breathing keyframes.
 */
const RHYTHM: Record<string, { amp: number; period: number; phase: number }> = {
  // Deliberately small: a real head stays fairly stable while the body sways,
  // so the visible life comes from the hair, and the head only hints at a turn.
  // At the default 240 px size this is about 4° of crown travel.
  head: { amp: 0.012, period: 7, phase: 0 },
  hair: { amp: 0.026, period: 7, phase: 0.6 },
  /* The neck drifts on the body's period but nearly opposite in phase, so the
     head is always slightly behind the shoulders. Small on purpose: this is the
     "carried, not mounted" cue, and anything above ~1% of the width reads as
     the head sliding off. */
  neck: { amp: 0.009, period: 7, phase: 2.2 },
  torso: { amp: 0.013, period: 4.8, phase: 1.9 },
  /* Same period as the breath, 0.7 rad late: follow-through, not a second
     rhythm. Different frequency here would read as two things wobbling. */
  bust: { amp: 0.008, period: 4.8, phase: 2.6 },
};

export interface WarpHandle {
  start(): void;
  stop(): void;
  /**
   * Amplitude multiplier, eased in: 1 is idle, ~0.4 reads as sleepy, ~1.7 as
   * being carried. Used to make the parts react to what is happening rather
   * than oscillating at one fixed rate forever.
   */
  setEnergy(k: number): void;
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
  // Amplitude multiplier, eased towards its target so a state change swells the
  // motion instead of snapping it.
  let energy = 1;
  let wanted = 1;
  const FRAME = 1000 / 30; // 30 fps is plenty for a smooth drift
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < FRAME) return;
    last = now;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    // ~0.3 s to settle: slow enough not to snap, fast enough that being picked
    // up reads as a reaction rather than as a fade.
    energy += (wanted - energy) * 0.1;
    for (let i = 0; i < maps.length; i++) {
      const r = RHYTHM[fields[i]?.name ?? ''] ?? RHYTHM.torso!;
      const theta = (t / r.period) * Math.PI * 2 + r.phase;
      // Fundamental, a second harmonic for asymmetry, and a very slow term so
      // the loop never lands on the same pose twice — a pure sine reads
      // mechanical after ten seconds.
      const wave = Math.sin(theta) * 0.74 + Math.sin(theta * 2 + 1.1) * 0.16 + Math.sin(theta * 0.37 + 2.3) * 0.1;
      maps[i]!.setAttribute('scale', (r.amp * intensity * width * wave * energy).toFixed(2));
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
    setEnergy(k: number) {
      wanted = Math.max(0, Math.min(3, k));
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
