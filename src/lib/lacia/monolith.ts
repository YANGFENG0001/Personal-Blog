/**
 * BLACK MONOLITH — one set of hardware in four configurations.
 *
 * Proportions come from the GSC 1/8 「レイシア 2018 BLACK MONOLITH 展開ver.」
 * product photos (see docs/lacia-rig/README.md §3 for the measurements): the
 * device is not a small hand prop. In the deployed form eight long faceted
 * slabs radiate from a hub behind her waist, the longest **0.85× her height** —
 * the figure the product photos actually measure, not a conservative discount.
 *
 * Everything is drawn in one 3000×3000 user space whose centre is the hub, so
 * a form switch never re-lays-out anything. The host positions the SVG so that
 * (1500,1500) lands on her waist; `--lr-mon-k` scales the whole thing about the
 * hub.
 *
 * ## Why the parts are shared between forms
 *
 * The first version drew four independent objects and cross-faded between them.
 * That reads as a slide deck: the casket fades out, a railgun fades in, and
 * nothing on screen ever *moves*. The setting says the casket **cracks into two
 * rails** (質量投射), so the honest implementation is one pair of shell halves
 * that are closed in one form and slid apart in another. Everything else
 * follows the same rule — the eight slabs are stowed inside the shell and
 * rotate out of the hub; the barrier plates unfold from the hub core. A form
 * switch is then a set of transforms the CSS interpolates, which is both
 * cheaper and far more convincing than four opacities.
 *
 * `data-form` on the <svg> is the only state; every position lives in
 * lacia-rig.css. That keeps the mechanical choreography (durations, staggers,
 * easing) in one place instead of split across a string builder and a
 * stylesheet.
 *
 * ## Extent
 *
 * At 1085 the fan reaches 1051 units either side of the hub, and
 * 1500 − 1051 = 449 is the margin left inside the viewBox. Anything longer
 * than ~1400 starts clipping at the left edge. The shell is parked at
 * `translate(300 0)` — screen right of her waist — and is 356 wide closed
 * (148 of front face + 30 of side face per half), 508 open.
 */

/** Slab angles (degrees from straight up) and lengths, in canvas units. */
const SLABS: readonly (readonly [number, number])[] = [
  [-152, 830],
  [-114, 1085],
  [-76, 1085], // carries the lens assembly
  [-38, 1085],
  [38, 1085],
  [76, 1085],
  [114, 1085],
  [152, 830],
];

const LENS_SLAB = 2;

/** How far each half slides out to open the bore. Gap = 2 × this.
 *
 *  96 was the first value and it was wrong in a way that is easy to see and hard
 *  to name: the bore came out 192 wide against 148-wide rails, so the device
 *  read as a window with two side panels. A mass projector is mostly rail. At 76
 *  the gap is 152 — narrower than one rail plus its lip — and the pair finally
 *  reads as a barrel. */
const SPLIT = 76;

/** A broad faceted plate, drawn pointing up from the hub. Widths scale with
 *  length so a long slab and a short one still read as the same object. */
function slabParts(len: number) {
  const wRoot = len * 0.076;
  const wTip = len * 0.038;
  const tipLen = len * 0.075;
  const cut = (f: number) => `M${-wRoot * (1 - f * 0.42)} ${-len * f} L${wRoot * (1 - f * 0.42)} ${-len * f}`;
  return {
    body: `M${-wRoot} -60 L${-wTip} ${-len} L${wTip} ${-len} L${wRoot} -60 Z`,
    /* the far face, seen edge-on — gives the plate thickness */
    side: `M${wRoot} -60 L${wRoot * 1.34} -60 L${wTip * 1.46} ${-len} L${wTip} ${-len} Z`,
    /* the lit half */
    facet: `M0 -60 L${-wTip} ${-len} L0 ${-len} Z`,
    tip: `M${-wTip} ${-len} L0 ${-len - tipLen} L${wTip} ${-len} Z`,
    cuts: [cut(0.18), cut(0.34), cut(0.52), cut(0.72)].join(' '),
    /* Root collar: without it the plate looks like it is painted on the air.
       A pivot band at the base says "this thing is mounted and swings". */
    collar: `M${-wRoot - 10} -104 L${wRoot + 10} -104 L${wRoot + 6} -52 L${-wRoot - 6} -52 Z`,
    seam: `M0 -${len * 0.14} L0 ${-len + 16}`,
    /* The streak runs along one edge and is what catches the eye while the
       slab turns — a highlight that travels reads as a curved, polished face. */
    glint: `M${-wTip * 0.62} ${-len * 0.96} L${-wRoot * 0.66} ${-len * 0.16}`,
  };
}

/**
 * One shell half, inner edge on x=0, drawn for the right side.
 *
 * Closed, the two halves meet at x=0 and their facing edges read as the casket
 * seam. Open, those same edges become the two glowing rails of the mass
 * projector. One piece of geometry, two readings — which is the whole reason
 * the split reads as a mechanism instead of a costume change.
 */
const HALF = {
  plate: `M0 512 L0 -644 L94 -644 L148 -520 L148 512 Z`,
  /* The outer side face — the sliver of thickness. Without it the casket is a
     cutout: 296 units wide and zero deep, which is exactly how the first
     version read (a door standing next to her, not a box). The far edge tapers
     toward the middle at both ends so the two faces converge, which is what a
     box looks like when the camera is off its centre line.
     Only the outer edge gets one, and that is not laziness: the inner edges
     face each other, so a side face there would be invisible closed and would
     read as a second rail when open. */
  side: `M148 512 L178 492 L178 -502 L148 -520 Z`,
  /* The bevel where the front face folds onto the side. One bright line is
     enough — it is the edge the light catches, and it is what stops the outline
     from being a single flat silhouette. */
  bevel: `M148 -520 L178 -502`,
  /* A shadow band just inside the outer edge: the side face would occlude the
     front face's last few units if this were real geometry, so it is cheaper to
     paint the occlusion than to model it. */
  inner: `M136 508 L136 -516`,
  /* Inset armour panel — a second skin, so the plate has thickness. It starts
     6 units in from the inner edge, not 14: at 14 the bare plate showed through
     as a 28-unit light band down the middle of the closed casket, which read as
     a gap between two panes of glass rather than as a seam. */
  face: `M6 478 L6 -600 L88 -600 L132 -502 L132 478 Z`,
  /* The machined lip along the facing edge. Closed it is the casket's spine;
     open it is the rail's inner cheek, which is why it needs to be its own
     shape and not just a stroke. */
  lip: `M0 508 L0 -640 L20 -640 L20 508 Z`,
  /* Knurling on the lip. Closed it is a spine seam that catches light in
     segments; open it is the machined cheek of a rail, which is the detail that
     sells "this surface has been worked". 18 units apart, because at 1:1 the
     device is ~0.37× canvas and anything finer than ~14 units disappears. */
  knurl: Array.from({ length: 26 }, (_, i) => `M3 ${492 - i * 42} L17 ${492 - i * 42}`).join(' '),
  /* A specular streak. Flat plates need one highlight that is not parallel to
     any edge, or they read as flat vector art. */
  sheen: `M34 -520 L118 -300`,
  /* Machined groove running the full length. */
  groove: `M40 -560 L40 470`,
  /* Cooling louvers, angled — horizontal slots read as a ruler. */
  vents: [0.56, 0.64, 0.72, 0.8].map((f) => `M62 ${-560 + f * 1000} L126 ${-586 + f * 1000}`).join(' '),
  /* Panel breaks. */
  cuts: `M6 -180 L148 -180 M6 120 L148 120 M6 360 L148 360`,
  /* The rail track, on the inner face. Only legible once the halves part. */
  track: `M26 -596 L26 486`,
  /* The facing edge itself. Closed it is the seam; open it is the rail. */
  edge: `M0 -640 L0 508`,
};

export function monolithSvg(uid: string): string {
  const id = (n: string) => `${uid}-${n}`;

  const slabs = SLABS.map(([deg, len], i) => {
    const s = slabParts(len);
    /* "One of the eight shares her senses and flies free" (README §3.3). The
       lens slab detaches along its own axis instead of getting a separate claw
       group: a claw big enough to read as detached pushed past the plate on
       every bearing that was not already occupied by a slab. Sliding this one
       out costs 80 units of width and nothing vertically, because −76° is
       almost horizontal. 80 is the ceiling — at 130 the tip lands exactly on
       the plate's left edge and gets clipped. */
    const free = i === LENS_SLAB ? 80 : 0;
    const lens =
      i === LENS_SLAB
        ? `<g class="lr-lens" transform="translate(0 ${-len * 0.6})">
             <rect class="lr-lens-mount" x="-70" y="-118" width="140" height="236" rx="26"/>
             <circle class="lr-lens-ring" r="108"/>
             <circle class="lr-lens-glass" r="80" fill="url(#${id('lens')})"/>
             <g class="lr-iris">
               ${[0, 60, 120, 180, 240, 300]
                 .map((a) => `<path class="lr-iris-blade" transform="rotate(${a})" d="M0 -14 L46 -40 L58 -8 L14 4 Z"/>`)
                 .join('')}
             </g>
             <circle class="lr-lens-core" r="26"/>
             <circle class="lr-lens-glint" r="12" cx="-24" cy="-22"/>
           </g>`
        : '';
    return `<g class="lr-slab lr-s${i + 1}" style="--deg:${deg}deg;--i:${i};--free:${free}px">
        <g class="lr-slab-w">
          <path class="lr-slab-side" d="${s.side}"/>
          <path class="lr-slab-body" d="${s.body}" fill="url(#${id('slab')})"/>
          <path class="lr-slab-facet" d="${s.facet}" fill="url(#${id('facet')})"/>
          <path class="lr-slab-tip" d="${s.tip}" fill="url(#${id('slab')})"/>
          <path class="lr-slab-cut" d="${s.cuts}"/>
          <path class="lr-slab-seam" d="${s.seam}"/>
          <path class="lr-slab-glint" d="${s.glint}"/>
          <path class="lr-slab-collar" d="${s.collar}" fill="url(#${id('slab')})"/>
          <path class="lr-slab-spark" d="${s.seam}" pathLength="100"/>
          ${lens}
        </g>
      </g>`;
  }).join('');

  /* Deployed hub: a ring the slabs pivot out of, with rotating ticks so the
     core never looks like a printed circle. */
  const hub = `<g class="lr-hub">
      <circle class="lr-hub-ring" r="66"/>
      <g class="lr-hub-ticks">
        ${Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${i * 30})" d="M0 -74 L0 -88"/>`).join('')}
      </g>
      <circle class="lr-hub-glow" r="44"/>
      <circle class="lr-hub-core" r="26"/>
    </g>`;

  /* Two halves. Closed they are the casket; parted they are the rails. */
  /* Two halves. Closed they are the casket; parted they are the rails.
     Paint order is near-to-far: the side face first (it is behind the front
     face), then the front face and everything printed on it, then the bevel
     last so it sits on the join. */
  const halfPaths = `<path class="lr-half-side" d="${HALF.side}" fill="url(#${id('side')})"/>
        <path class="lr-half-plate" d="${HALF.plate}" fill="url(#${id('slab')})"/>
        <path class="lr-half-inner" d="${HALF.inner}"/>
        <path class="lr-half-face" d="${HALF.face}" fill="url(#${id('face')})"/>
        <path class="lr-half-lip" d="${HALF.lip}"/>
        <path class="lr-half-knurl" d="${HALF.knurl}"/>
        <path class="lr-half-groove" d="${HALF.groove}"/>
        <path class="lr-half-vents" d="${HALF.vents}"/>
        <path class="lr-half-cuts" d="${HALF.cuts}"/>
        <path class="lr-half-track" d="${HALF.track}"/>
        <path class="lr-half-sheen" d="${HALF.sheen}"/>
        <path class="lr-half-edge" d="${HALF.edge}"/>
        <path class="lr-half-bevel" d="${HALF.bevel}"/>`;
  /* No `transform` attribute on the groups whose position a form changes: a CSS
     transform would override it anyway, and two sources of placement is how you
     end up with a casket that opens in the wrong direction. The hip offset lives
     in lacia-rig.css. */
  const shell = `<g class="lr-shell">
      <g class="lr-half lr-half-r">${halfPaths}</g>
      <g class="lr-half lr-half-l"><g transform="scale(-1 1)">${halfPaths}</g></g>
    </g>`;

  /* The casket's core window. It has to be painted *after* the shell: the first
     version put it before, so both halves covered it completely and the "量子
     计算机核心" the setting describes was drawn, animated, and never once on
     screen. On top, it lands on the spine — which is what the setting calls a
     core seam anyway. */
  const casketCore = `<g class="lr-shell-core">
      <circle class="lr-casket-core" cy="-360" r="22"/>
      <path class="lr-casket-slit" d="M-58 -360 L58 -360"/>
    </g>`;

  /* Mass projector: what the parted halves expose. Everything here sits in the
     gap, so it is invisible until SPLIT opens.
     The gap is measured from the *left* half's inner edge (local x = 0), not
     centred on the shell: the halves open like a door, with the near one fixed.
     A symmetric split was the first attempt and it walked the near rail 99
     units into her body — the device is only 23 units clear of her when closed,
     so there is no room to open toward her. */
  const BW = SPLIT; // bore half-width
  const BX = SPLIT; // bore centre
  /* Accelerator coils across the bore. Without them the gap is a dark window;
     a barrel is a dark window with rings down it.
     They are bowed 9 units, not straight. A straight line across a gap is a
     rule mark; a shallow arc reads as a coil passing round the back of the
     bore, which is the only cue that says "tube" rather than "slot". */
  const coilY = (f: number) => -592 + f * 1078;
  const coils = [0.9, 0.76, 0.62, 0.48, 0.34]
    .map((f, i) => {
      const y = coilY(f);
      return `<path class="lr-coil lr-coil-${i}" d="M${BX - BW + 10} ${y} Q ${BX} ${y - 9} ${BX + BW - 10} ${y}"/>`;
    })
    .join('');
  const bore = `<g class="lr-rails">
      <path class="lr-bore" d="M${BX - BW} -592 L${BX + BW} -592 L${BX + BW} 486 L${BX - BW} 486 Z" fill="url(#${id('bore')})"/>
      <path class="lr-bore-shade" d="M${BX - BW} -592 L${BX - BW + 30} -592 L${BX - BW + 30} 486 L${BX - BW} 486 Z" fill="url(#${id('boreL')})"/>
      <path class="lr-bore-shade" d="M${BX + BW - 30} -592 L${BX + BW} -592 L${BX + BW} 486 L${BX + BW - 30} 486 Z" fill="url(#${id('boreR')})"/>
      <path class="lr-bore-glow" d="M${BX - 40} -560 L${BX + 40} -560 L${BX + 40} 470 L${BX - 40} 470 Z" fill="url(#${id('boreGlow')})"/>
      ${coils}
      <path class="lr-cradle" d="M${BX - BW} 452 L${BX + BW} 452 L${BX + BW} 512 L${BX - BW} 512 Z"/>
      <path class="lr-channel" d="M${BX - 7} -556 L${BX + 7} -556 L${BX + 7} -300 L${BX - 7} -300 Z"/>
      <path class="lr-flow" d="M${BX} -556 L${BX} -300" pathLength="100"/>
      <ellipse class="lr-slug" cx="${BX}" cy="-420" rx="24" ry="40"/>
      <path class="lr-muzzle-collar" d="M${BX - BW + 3} -620 L${BX - BW + 3} -556 M${BX + BW - 3} -620 L${BX + BW - 3} -556"/>
      <ellipse class="lr-muzzle" cx="${BX}" cy="-592" rx="${BW}" ry="30"/>
      <ellipse class="lr-muzzle-in" cx="${BX}" cy="-592" rx="${BW - 16}" ry="20"/>
      <ellipse class="lr-muzzle-core" cx="${BX}" cy="-592" rx="26" ry="10"/>
    </g>`;

  /* Barrier: crystal plates projected forward from the core. They start at the
     hub and expand, which is why each hex carries its own `--i` — the stagger
     is the difference between "a wall appeared" and "a wall was built". */
  /* Three nested outlines per plate, not one. A single hexagon outline is a
     wireframe; the inner rim is the bevel of a cut crystal, and the lit top
     edge is where a real plate would catch the light. Seven plates × three
     lines still costs less than one more plate. */
  const hexAt = (x: number, y: number, i: number) =>
    `<g class="lr-hex lr-h${i + 1}" style="--hx:${x}px;--hy:${y}px;--i:${i}">
       <path class="lr-hex-fill" d="M0 -132 L114 -66 L114 66 L0 132 L-114 66 L-114 -66 Z" fill="url(#${id('hex')})"/>
       <path class="lr-hex-inner" d="M0 -80 L69 -40 L69 40 L0 80 L-69 40 L-69 -40 Z"/>
       <path class="lr-hex-line" d="M0 0 L0 -66 M0 0 L-57 33 M0 0 L57 33"/>
       <path class="lr-hex-rim" d="M-114 -66 L0 -132 L114 -66"/>
       <circle class="lr-hex-node" r="7"/>
     </g>`;
  /* The cluster starts at hub−500, which is her chin (canvas y≈200): a barrier
     that covers the torso has to stay off the face, or the form reads as a
     rendering fault and hides the expression work.
     The row pitch is 198, not 250. These are pointy-top hexagons with a
     half-height of 132, so a honeycomb needs rows 1.5 × 132 apart; at 250 the
     rows floated apart and the diagonals stopped meeting, which read as seven
     separate tiles rather than as one wall. */
  const shield = `<g class="lr-shield">
      <path class="lr-field" d="M0 -500 L342 -320 L342 -10 L0 270 L-342 -10 L-342 -320 Z" fill="url(#${id('field')})"/>
      ${hexAt(-114, -370, 0)}${hexAt(114, -370, 1)}
      ${hexAt(-228, -172, 2)}${hexAt(0, -172, 3)}${hexAt(228, -172, 4)}
      ${hexAt(-114, 26, 5)}${hexAt(114, 26, 6)}
    </g>`;

  return `<svg class="lr-monolith" data-form="coffin" viewBox="0 0 3000 3000" aria-hidden="true" focusable="false">
      <defs>
        /* The form ramp. It used to be gentle because a bright outline was
           doing the silhouette work; now that the outline is a 0.14-alpha rim,
           this gradient is the only thing saying "this is a solid". */
        <linearGradient id="${id('slab')}" x1="0" y1="1" x2="0.55" y2="0">
          <stop offset="0" stop-color="#02040a"/>
          <stop offset="0.3" stop-color="#0a1119"/>
          <stop offset="0.62" stop-color="#1c2937"/>
          <stop offset="0.86" stop-color="#33465c"/>
          <stop offset="1" stop-color="#4a627e"/>
        </linearGradient>
        /* The inset panel is 126 of the 148 units of the front face, so when it
           was a flat 72%-opaque black it covered the plate's ramp and the whole
           casket came out as one value. It gets its own ramp instead. */
        <linearGradient id="${id('face')}" x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0" stop-color="#04070c"/>
          <stop offset="0.42" stop-color="#0b131c"/>
          <stop offset="0.76" stop-color="#182532"/>
          <stop offset="1" stop-color="#2b3d50"/>
        </linearGradient>
        <linearGradient id="${id('bore')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0b1520"/>
          <stop offset="0.55" stop-color="#050a11"/>
          <stop offset="1" stop-color="#0a121c"/>
        </linearGradient>
        /* The bore is not flat either: each rail casts into it, so the two edges
           are darker than the middle. Two one-directional gradients rather than
           a filter — a filter here would cost a full-surface blur every frame
           for something that is two static rectangles. */
        <linearGradient id="${id('boreL')}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0.85"/>
          <stop offset="1" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${id('boreR')}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity="0.85"/>
        </linearGradient>
        /* A tube with light inside it is not a black rectangle: there is always
           something in the middle. But the bore has to stay **darker than the
           rails** — it is a hole, and the first value (0.18) turned it into a
           neon column that read as a glass tube with the rails as its frame.
           0.07 is a sheen, not a light source. */
        <linearGradient id="${id('boreGlow')}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8fe3ff" stop-opacity="0"/>
          <stop offset="0.5" stop-color="#8fe3ff" stop-opacity="0.07"/>
          <stop offset="1" stop-color="#8fe3ff" stop-opacity="0"/>
        </linearGradient>
        /* The side face is a shade darker than the front face and slightly
           cooler: it is turned away from the light, and the value break is what
           makes the two planes separable at thumbnail size. */
        <linearGradient id="${id('side')}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#02040a"/>
          <stop offset="0.6" stop-color="#0a1420"/>
          <stop offset="1" stop-color="#1b2a3b"/>
        </linearGradient>
        <linearGradient id="${id('facet')}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#7c9cb8" stop-opacity="0.62"/>
          <stop offset="0.55" stop-color="#b9d8ef" stop-opacity="0.3"/>
          <stop offset="1" stop-color="#dff2ff" stop-opacity="0.14"/>
        </linearGradient>
        <radialGradient id="${id('lens')}">
          <stop offset="0" stop-color="#eafaff"/>
          <stop offset="0.35" stop-color="#8fe3ff"/>
          <stop offset="0.72" stop-color="#1d4a68"/>
          <stop offset="1" stop-color="#050a10"/>
        </radialGradient>
        <linearGradient id="${id('field')}" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stop-color="#8fe3ff" stop-opacity="0.26"/>
          <stop offset="1" stop-color="#5aa8d8" stop-opacity="0.05"/>
        </linearGradient>
        <radialGradient id="${id('hub')}" cx="0.5" cy="0.5">
          <stop offset="0" stop-color="#eafaff" stop-opacity="0.9"/>
          <stop offset="0.6" stop-color="#8fe3ff" stop-opacity="0.35"/>
          <stop offset="1" stop-color="#8fe3ff" stop-opacity="0"/>
        </radialGradient>
        /* Barrier plates: densest in the middle. A flat fill made them read as
           decals on the air — the eye needs the plate to be a *volume* it is
           looking into, and a centre-weighted radial is the cheapest way to say
           that without a filter. */
        <radialGradient id="${id('hex')}" cx="0.5" cy="0.42">
          <stop offset="0" stop-color="#9fe8ff" stop-opacity="0.3"/>
          <stop offset="0.62" stop-color="#5aa8d8" stop-opacity="0.16"/>
          <stop offset="1" stop-color="#1d4a68" stop-opacity="0.06"/>
        </radialGradient>
      </defs>
      <g class="lr-bm-scale">
        <g transform="translate(1500 1500)">
          <g class="lr-bm-body">
            ${bore}
            ${shell}
            ${casketCore}
            ${shield}
            <g class="lr-fan">
              ${slabs}
              ${hub}
            </g>
          </g>
        </g>
      </g>
    </svg>`;
}
