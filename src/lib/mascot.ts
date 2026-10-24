/**
 * The site's original mascots ("看板娘"), drawn as inline SVG so they need no
 * image request. All characters are original designs.
 *
 * - chibi: the first, simple chibi girl (kept for the 夏日物语 preset).
 * - haru:  long chestnut hair, sakura hairpin, sailor uniform.
 * - sora:  dark bob with a side braid, sun hairclip, clear umbrella.
 * - lacia: lavender hair, ice-blue eyes, a homage to BEATLESS (not the
 *          official design).
 *
 * The three anime busts share one construction so the site stays consistent:
 *
 *   head   98 tall × 77 wide (≈1.27 ratio), crown at y=20, chin at y=118
 *   eyes   line at y≈79, each 22 × 25, one eye-width apart, irises filling
 *          the socket, thick upper lash + flick, double-lid crease, lower lash
 *   nose   a single 2px shadow curve at y≈93 (anime noses are not outlined)
 *   mouth  small, 8 wide, at y≈105, 13 above the chin
 *   neck   20 wide, ~26 visible below the chin, with a jaw shadow
 *   body   shoulders 104 wide (≈1.35 heads) at y=167, widening to 134 at the
 *          bottom cut (y=250)
 *   hair   one fringe mass whose lower edge is a chain of soft points (never a
 *          row of separate locks — those read as fangs or bricks), over a dark
 *          arc that fills the notches so they show hair instead of skin; side
 *          locks taper narrow-wide-point; the back fall gets gloss + strands.
 *          Never a broad translucent highlight: it erases the strand seams and
 *          turns the whole fringe into a veil with a jagged edge.
 *
 * Class names (ms-*) drive the CSS animations: breathing, hair sway, blinking,
 * eye-follow and a happy face while talking. Geometry is shared through the
 * constants below; only colour and outfit differ per character.
 */

export type MascotId = 'chibi' | 'haru' | 'sora' | 'lacia';

export const MASCOTS: { id: MascotId; name: string; desc: string }[] = [
  { id: 'haru', name: '小春', desc: '樱色发卡、长发、水手服，安静地陪你读书。' },
  { id: 'sora', name: '小晴', desc: '短发侧辫、太阳发夹，撑着透明雨伞的晴天少女。' },
  { id: 'lacia', name: '蕾西亚', desc: '淡紫长发、冰蓝眼眸，身后浮着黑色秘棺的 hIE。（致敬《BEATLESS》的原创形象，非官方立绘）' },
  { id: 'chibi', name: 'Q 版', desc: '最初的 Q 版夏日制服少女。' },
];

export function isMascotId(id: string): id is MascotId {
  return MASCOTS.some((m) => m.id === id);
}

/* ------------------------------------------------------------------ chibi */

const CHIBI = `<svg class="mascot-svg ms-chibi" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="chibi-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9dc"/><stop offset="1" stop-color="#f3c9b8"/></linearGradient>
    <linearGradient id="chibi-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6f6"/></linearGradient>
    <linearGradient id="chibi-skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d4c96"/><stop offset="1" stop-color="#2a3468"/></linearGradient>
  </defs>
  <ellipse class="ms-shadow" cx="80" cy="192" rx="42" ry="6"/>
  <g class="ms-body">
    <path class="ms-hair" d="M30 70 q-22 26 -10 64 q6 -20 18 -30 z"/>
    <path class="ms-hair" d="M130 70 q22 26 10 64 q-6 -20 -18 -30 z"/>
    <circle class="ms-ribbon" cx="34" cy="66" r="7"/><circle class="ms-ribbon" cx="126" cy="66" r="7"/>
    <rect class="ms-skin" x="62" y="160" width="10" height="24" rx="4"/><rect class="ms-skin" x="88" y="160" width="10" height="24" rx="4"/>
    <path class="ms-shoe" d="M58 182 h18 v6 h-20z M86 182 h18 v6 h-20z"/>
    <path class="ms-skirt" d="M52 146 h56 l10 22 h-76z"/>
    <path class="ms-pleat" d="M66 148 l-4 20 M80 148 v20 M94 148 l4 20"/>
    <path class="ms-shirt" d="M54 116 q26 -10 52 0 l4 32 h-60z"/>
    <path class="ms-collar" d="M58 116 q22 18 44 0 l-6 14 q-16 8 -32 0z"/>
    <path class="ms-scarf" d="M76 128 l4 8 l4 -8 l-4 -3z"/>
    <path class="ms-skin" d="M52 122 q-10 16 0 28 l8 -4 q-6 -10 0 -20z"/>
    <path class="ms-skin" d="M108 122 q10 16 0 28 l-8 -4 q6 -10 0 -20z"/>
    <ellipse class="ms-cuff" cx="52" cy="148" rx="5" ry="4"/>
    <ellipse class="ms-cuff" cx="108" cy="148" rx="5" ry="4"/>
    <g class="ms-book"><path class="ms-cover" d="M58 136 l22 6 l22 -6 v18 l-22 6 l-22 -6z"/><path class="ms-pages" d="M80 142 v18"/></g>
    <g class="ms-head">
      <circle class="ms-skin" cx="80" cy="74" r="40"/>
      <ellipse class="ms-face-shade" cx="80" cy="99" rx="32" ry="23"/>
      <ellipse class="ms-earring" cx="42" cy="97" rx="2.4" ry="2.4"/>
      <ellipse class="ms-earring" cx="118" cy="97" rx="2.4" ry="2.4"/>
      <path class="ms-hair" d="M40 76 q-2 -46 40 -48 q42 2 40 48 q-8 -22 -22 -26 q-6 12 -20 14 q4 -8 2 -14 q-14 14 -40 26z"/>
      <path class="ms-hair-hi" d="M58 40 q10 -6 22 -6"/>
      <g class="ms-eyes">
        <ellipse class="ms-eye" cx="64" cy="82" rx="6.5" ry="8"/><ellipse class="ms-eye" cx="96" cy="82" rx="6.5" ry="8"/>
        <circle class="ms-shine" cx="66" cy="79" r="2.3"/><circle class="ms-shine" cx="98" cy="79" r="2.3"/>
      </g>
      <ellipse class="ms-blush" cx="56" cy="96" rx="6" ry="3"/><ellipse class="ms-blush" cx="104" cy="96" rx="6" ry="3"/>
      <path class="ms-mouth" d="M75 98 q5 5 10 0"/>
      <path class="ms-clip" d="M106 50 l8 -4 l2 6z"/>
    </g>
  </g>
</svg>`;

/* ------------------------------------------------------- shared geometry */

const SKIN = { base: '#ffeade', low: '#fbd7c7', shade: '#f0b6a4', line: '#dc9a88' };

/** Face silhouette: wide cranium, straight jaw line, soft rounded chin. */
const FACE =
  'M100 20C82 20 66 34 63 55C61 66 61 75 64 84C67 93 72 99 78 104C83 109 91 114 96 116.5C98 117.6 102 117.6 104 116.5C109 114 117 109 122 104C128 99 133 93 136 84C139 75 139 66 137 55C134 34 118 20 100 20Z';

/** Neck, drawn under the head; the head covers everything above the chin. */
const NECK = 'M90 106V152C90 158 94 162 100 162C106 162 110 158 110 152V106Z';

/** Shadow the jaw casts on the neck. */
const NECK_SHADE = 'M89.5 118C89.5 130 94 137 100 138.5C106 137 110.5 130 110.5 118Z';

/** Shoulders / chest, cut by the bottom mask fade. */
const BODY =
  'M100 147C80 147 60 155 48 167C40 175 35 185 33 250H167C165 185 160 175 152 167C140 155 120 147 100 147Z';

type Tip = [x: number, depth: number];

interface Look {
  id: MascotId;
  hair: [string, string, string];
  hairHi: string;
  iris: [string, string, string];
  pupil: string;
  lash: string;
  /** half-widths of the back-hair fall at crown / shoulder / bottom. */
  backW: [number, number, number];
  /** fringe tips, left to right: [x, depth]. */
  bangs: Tip[];
  outfit: string;
  outfitBase: string;
  accessory: string;
  behind?: string;
  front?: string;
}

/* -------------------------------------------------------------------- eye */

/**
 * One eye, drawn on the left half; the right eye is the same group mirrored.
 * Socket 22 × 25 with the iris filling it, a thick upper lash with an outward
 * flick, a double-lid crease on the skin and a thin lower lash.
 */
function eye(L: Look, side: 'l' | 'r'): string {
  const clip = `${L.id}-eye-${side}`;
  const socket =
    'M91.5 81C88.5 69.5 79.5 65.5 72.2 71.5C69.2 74.2 68.6 77.8 69.6 80.8C72.6 88 81 92 88.2 89C90.8 87.8 91.7 84.4 91.5 81Z';
  return `<clipPath id="${clip}"><path d="${socket}"/></clipPath>
      <path d="${socket}" fill="#fdfbff"/>
      <g clip-path="url(#${clip})">
        <g class="ms-iris ms-iris-${side}">
          <ellipse cx="80" cy="79.4" rx="8.4" ry="10.8" fill="url(#${L.id}-iris)"/>
          <ellipse cx="80" cy="79.8" rx="3.5" ry="5.2" fill="${L.pupil}"/>
          <path d="M71.8 88.6Q80 93.4 88.2 88.4" fill="none" stroke="${L.iris[2]}" stroke-width="2.2" opacity=".9"/>
          <ellipse cx="75.6" cy="73.8" rx="2.9" ry="3.7" fill="#fff" transform="rotate(-16 75.6 73.8)"/>
          <circle cx="84.4" cy="86" r="1.5" fill="#fff" opacity=".92"/>
        </g>
        <path d="M67.5 69.5Q80 63 93 70.5V78Q80 69.5 67.5 76Z" fill="${L.iris[0]}" opacity=".4"/>
      </g>
      <path d="M91.6 80.4C88.4 68.6 79.2 64 71.6 70.8C68.6 73.4 68.2 77 69.4 80.2" fill="none" stroke="${L.lash}" stroke-width="2.9" stroke-linecap="round"/>
      <path d="M70.8 79.6C69 76 69.5 72.6 72 70.4L66.6 69.6C68.1 72.4 69 75.6 69.4 79.2Z" fill="${L.lash}"/>
      <path d="M70.4 81.8C73.5 88.2 81 91.6 87.4 89" fill="none" stroke="${L.lash}" stroke-width="1.15" opacity=".55" stroke-linecap="round"/>`;
}

/** Double-lid crease + eyebrow: on the skin, so it must not blink with the eye. */
function eyeSkin(L: Look, side: 'l' | 'r'): string {
  const crease =
    '<path d="M88 65.2C82.6 60.4 74.4 60.8 70 66.4" fill="none" stroke="' + L.lash + '" stroke-width="1.05" opacity=".45" stroke-linecap="round"/>' +
    '<path d="M74 57.4C78.6 53.4 85.6 53.6 90 57" fill="none" stroke="' + L.hair[2] + '" stroke-width="2" opacity=".55" stroke-linecap="round"/>';
  return side === 'l' ? crease : `<g transform="translate(200 0) scale(-1 1)">${crease}</g>`;
}

/* ------------------------------------------------------------------- hair */

function backHair(L: Look): string {
  const [a, b, c] = L.backW;
  const l1 = 100 - a, l2 = 100 - b, l3 = 100 - c;
  const r1 = 100 + a, r2 = 100 + b, r3 = 100 + c;
  const d =
    `M100 14C${100 - a * 0.74} 14 ${l1} 32 ${l1} 56` +
    `C${l1} 84 ${l2} 116 ${l2} 154C${l2} 188 ${l3} 220 ${l3} 250` +
    `H${r3}C${r3} 220 ${r2} 188 ${r2} 154C${r2} 116 ${r1} 84 ${r1} 56` +
    `C${r1} 32 ${100 + a * 0.74} 14 100 14Z`;
  const gloss =
    `<path d="M60 62C52 104 47 152 43 208C49 208 53 158 57 116C61 84 63 72 66 62Z" fill="url(#${L.id}-gloss)"/>` +
    `<path d="M140 62C148 104 153 152 157 208C151 208 147 158 143 116C139 84 137 72 134 62Z" fill="url(#${L.id}-gloss)"/>`;
  // A few long strand lines keep the fall from reading as one flat slab.
  const strands =
    `<path d="M74 70C68 110 64 158 60 214M88 66C84 108 82 156 80 214M126 66C130 108 132 156 134 214M140 70C146 110 150 158 154 214" fill="none" stroke="${L.hair[2]}" stroke-width=".9" opacity=".28"/>`;
  return `<path d="${d}" fill="url(#${L.id}-hair)" stroke="${L.hair[2]}" stroke-width="1"/>${gloss}${strands}`;
}

/**
 * Fringe: a smooth scalp cap (crown silhouette + hairline), then a few wide
 * overlapping locks, then thin highlight strokes. Keeping the highlights thin
 * is what preserves the strand seams — a broad translucent shape turns the
 * whole fringe into a flat veil with a jagged edge.
 */
/**
 * Fringe silhouette: one dome over the skull whose lower edge is a chain of
 * soft points. `tips` lists [x, depth] left to right; the edge leaves the left
 * temple and returns to the right one, with a quadratic notch between tips.
 * Drawing the fringe as one mass (instead of separate lock shapes) is what
 * keeps it from reading as a row of fangs or a stack of bricks.
 */
function fringePath(tips: [number, number][], templeY = 56, notch = 8): string {
  const pts: [number, number][] = [[50, templeY], ...tips, [150, templeY]];
  let edge = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    edge += `Q${Math.round(x0 + (x1 - x0) * 0.36)} ${Math.round(Math.min(y0, y1) - notch)} ${x1} ${y1}`;
  }
  return `M100 12C71 12 51 28 50 ${templeY}${edge}C149 28 129 12 100 12Z`;
}

function frontHair(L: Look): string {
  const s = L.hair[2];
  const g = `url(#${L.id}-hair)`;
  const fringe = fringePath(L.bangs);
  // Under-layer: a smooth arc that sits *between* the notch line and the tip
  // line, in the darkest hair tone. The notches reveal this instead of skin, so
  // the tips read as strands; because it never drops below the tips it cannot
  // show up as a second, darker fringe.
  const under = 'M50 40C66 62 134 62 150 40L150 30C150 22 128 15 100 15C72 15 50 22 50 30Z';
  // Strand seams: from each notch up into the hair mass, tapering off.
  const seams = L.bangs
    .slice(0, -1)
    .map(([x], i) => {
      const nx = Math.round((x + L.bangs[i + 1][0]) / 2);
      const top = 28 + (i % 2) * 7;
      return `<path d="M${nx} ${top}C${nx - 2} ${top + 12} ${nx - 1} 48 ${nx} 56" fill="none" stroke="${s}" stroke-width=".8" opacity=".3"/>`;
    })
    .join('');
  const hi =
    `<path d="M70 34C78 26 88 23 97 23" fill="none" stroke="${L.hairHi}" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>` +
    `<path d="M104 23C114 24 124 28 131 34" fill="none" stroke="${L.hairHi}" stroke-width="2" opacity=".45" stroke-linecap="round"/>` +
    `<path d="M63 44C70 34 80 30 88 29" fill="none" stroke="${L.hairHi}" stroke-width="1.3" opacity=".3" stroke-linecap="round"/>`;
  const side = (flip: boolean) => {
    const p = 'M63 46C56 74 55 104 58 132C60 154 56 172 52 192C60 182 66 162 68 138C70 110 70 78 67 50Z';
    const el =
      `<path class="ms-lock${flip ? ' ms-lock-r' : ''}" d="${p}" fill="${g}" stroke="${s}" stroke-width=".7" stroke-opacity=".35"/>` +
      `<path d="M62 62C59 88 59 114 60 138" fill="none" stroke="${L.hairHi}" stroke-width="1.2" opacity=".22" stroke-linecap="round"/>`;
    return flip ? `<g transform="translate(200 0) scale(-1 1)">${el}</g>` : el;
  };
  return (
    side(false) + side(true) +
    `<path d="${under}" fill="${s}" opacity=".9"/>` +
    `<path d="${fringe}" fill="${g}" stroke="${s}" stroke-width="1" stroke-linejoin="round"/>` +
    seams + hi + L.accessory
  );
}

/* ------------------------------------------------------------------- bust */

function bust(L: Look): string {
  const id = L.id;
  const mirror = 'translate(200 0) scale(-1 1)';
  const happy = `<path d="M71.5 83Q80 71 88.5 83" fill="none" stroke="${L.lash}" stroke-width="2.8" stroke-linecap="round"/>`;
  return `<svg class="mascot-svg ms-anime" viewBox="0 0 200 250" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-hair" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="150"><stop offset="0" stop-color="${L.hair[0]}"/><stop offset=".45" stop-color="${L.hair[1]}"/><stop offset="1" stop-color="${L.hair[2]}"/></linearGradient>
    <linearGradient id="${id}-gloss" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="212"><stop offset="0" stop-color="${L.hairHi}" stop-opacity=".55"/><stop offset=".6" stop-color="${L.hairHi}" stop-opacity=".2"/><stop offset="1" stop-color="${L.hairHi}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.iris[0]}"/><stop offset=".58" stop-color="${L.iris[1]}"/><stop offset="1" stop-color="${L.iris[2]}"/></linearGradient>
    <linearGradient id="${id}-skin" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="170"><stop offset="0" stop-color="${SKIN.base}"/><stop offset="1" stop-color="${SKIN.low}"/></linearGradient>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="${id}-mask" maskUnits="userSpaceOnUse" x="-40" y="-60" width="280" height="310"><rect x="-40" y="-60" width="280" height="310" fill="url(#${id}-fade)"/></mask>
  </defs>
  <g mask="url(#${id}-mask)">
    ${L.behind ?? ''}
    <g class="ms-breath">
      ${backHair(L)}
      <path d="${NECK}" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
      <path d="${NECK_SHADE}" fill="${SKIN.shade}" opacity=".5"/>
      ${L.outfit}
      ${L.front ?? ''}
      <g class="ms-head">
        <path d="${FACE}" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
        <path d="M136 84C133 93 128 99 122 104C127 97 131 91 133 81Z" fill="${SKIN.shade}" opacity=".3"/>
        <path d="M66 60C76 55 88 53 100 53L100 62C89 62 77 64 68 69Z" fill="${SKIN.shade}" opacity=".12"/>
        <g class="ms-eyes">
          <g>${eye(L, 'l')}</g>
          <g transform="${mirror}">${eye(L, 'r')}</g>
        </g>
        <g class="ms-happy" stroke-linecap="round">${happy}<g transform="${mirror}">${happy}</g></g>
        ${eyeSkin(L, 'l')}${eyeSkin(L, 'r')}
        <path d="M99.4 89.6C101.4 92.4 101.6 94.2 99.8 95" fill="none" stroke="${SKIN.line}" stroke-width="1.15" stroke-linecap="round" opacity=".7"/>
        <path class="ms-mouth-idle" d="M96.6 104.4Q100 107.6 103.4 104.4" fill="none" stroke="#c4687a" stroke-width="1.6" stroke-linecap="round"/>
        <path class="ms-mouth-talk" d="M96 103.2Q100 111.6 104 103.2Q100 106 96 103.2Z" fill="#c25a6a"/>
        <g class="ms-cheeks">
          <ellipse cx="80" cy="97.4" rx="7.4" ry="3.2" fill="#ff9fb3" opacity=".3"/><ellipse cx="120" cy="97.4" rx="7.4" ry="3.2" fill="#ff9fb3" opacity=".3"/>
          <path d="M75.6 99.2l2.2-3.2 M79.4 99.2l2.2-3.2 M83.2 99.2l2.2-3.2 M115.6 99.2l2.2-3.2 M119.4 99.2l2.2-3.2 M123.2 99.2l2.2-3.2" stroke="#ee7890" stroke-width=".85" opacity=".4" stroke-linecap="round"/>
        </g>
        ${frontHair(L)}
      </g>
    </g>
  </g>
</svg>`;
}

/* -------------------------------------------------------------- characters */

const sakuraFlower = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288]
    .map((a) => `<path transform="rotate(${a})" d="M0 0 C-4.4 -4 -3.6 -10.4 -1 -11.6 L0 -10 L1 -11.6 C3.6 -10.4 4.4 -4 0 0Z" fill="#ffd0e0" stroke="#ee8aaa" stroke-width=".6"/>`)
    .join('')}<circle r="1.9" fill="#ffd877"/></g>`;

const HARU: Look = {
  id: 'haru',
  hair: ['#7c4d3e', '#563429', '#33201a'],
  hairHi: '#eec1a6',
  iris: ['#4b2443', '#a5527c', '#f7b3cc'],
  pupil: '#2a1024',
  lash: '#2d1a1f',
  backW: [40, 47, 54],
  bangs: [[64, 62], [88, 57], [112, 57], [138, 63]],
  outfitBase: '#f6f7fc',
  outfit: `<path d="${BODY}" fill="#f6f7fc" stroke="#ccd2e2" stroke-width="1"/>
      <path d="M52 186C50 208 49 228 48 250M148 186C150 208 151 228 152 250" fill="none" stroke="#d7dcea" stroke-width="1.2"/>
      <path d="M86 148L100 214L114 148L127 155L100 227L73 155Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M50 170C62 159 76 152 87 149L90 160C79 163 66 170 56 179Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M150 170C138 159 124 152 113 149L110 160C121 163 134 170 144 179Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1" stroke-linejoin="round"/>
      <path d="M79 155L100 220L121 155" fill="none" stroke="#fff" stroke-width="1.4" opacity=".9"/>
      <path d="M75 157L100 224L125 157" fill="none" stroke="#fff" stroke-width=".9" opacity=".6"/>
      <path d="M100 216L86 208L83 222Z" fill="#e2577f" stroke="#b83a62" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M100 216L114 208L117 222Z" fill="#e2577f" stroke="#b83a62" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M100 218L94 246L99 246Z" fill="#d84a73"/>
      <path d="M100 218L106 246L101 246Z" fill="#d84a73"/>
      <ellipse cx="100" cy="216" rx="4.4" ry="3.8" fill="#c93f68"/>`,
  accessory: sakuraFlower(132, 60, 0.95) + sakuraFlower(140, 70, 0.6),
};

const SORA: Look = {
  id: 'sora',
  hair: ['#3d4869', '#252c45', '#151929'],
  hairHi: '#a6caf5',
  iris: ['#173563', '#3f8fd8', '#b0e9ff'],
  pupil: '#0d1830',
  lash: '#161a2a',
  backW: [39, 45, 51],
  bangs: [[66, 58], [90, 53], [112, 53], [138, 59]],
  behind: `<g class="ms-umb">
      <path d="M54 44C58 130 62 190 68 244" fill="none" stroke="#b9c3d2" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M4 46Q54 -12 104 46Q91 38 79 46Q66 38 54 46Q41 38 29 46Q16 38 4 46Z" fill="#e8f4ff" fill-opacity=".5" stroke="#fff" stroke-opacity=".9" stroke-width="1.3"/>
      <path d="M54 -6V46M54 -6Q38 12 29 46M54 -6Q70 12 79 46M54 -6Q24 18 4 46M54 -6Q84 18 104 46" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7"/>
      <g fill="#fff" opacity=".85"><circle cx="30" cy="16" r="1.4"/><circle cx="70" cy="10" r="1.2"/><circle cx="86" cy="30" r="1.5"/><circle cx="44" cy="4" r="1"/><circle cx="14" cy="34" r="1.1"/></g>
      <path d="M54 -8V-14" stroke="#b9c3d2" stroke-width="1.8" stroke-linecap="round"/>
    </g>`,
  outfitBase: '#7cc0ec',
  outfit: `<path d="${BODY}" fill="#7cc0ec" stroke="#4f97c9" stroke-width="1"/>
      <path d="M100 138C80 138 64 150 58 168C72 160 86 156 100 156C114 156 128 160 142 168C136 150 120 138 100 138Z" fill="#5fa9dc" stroke="#3f88bc" stroke-width="1"/>
      <path d="M86 148C92 143 108 143 114 148L112 162C104 158 96 158 88 162Z" fill="#5fa9dc" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M100 162V250" stroke="#3f88bc" stroke-width="1.6"/>
      <path d="M92 162V250M108 162V250" stroke="#5aa3d6" stroke-width="1.1" opacity=".75"/>
      <circle cx="100" cy="194" r="2.2" fill="#f4f8fc" stroke="#3f88bc" stroke-width=".7"/>
      <circle cx="100" cy="220" r="2.2" fill="#f4f8fc" stroke="#3f88bc" stroke-width=".7"/>
      <path d="M58 220L82 214L82 221L58 227Z" fill="#6fb6e6" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M142 220L118 214L118 221L142 227Z" fill="#6fb6e6" stroke="#3f88bc" stroke-width="1" stroke-linejoin="round"/>
      <path d="M54 188C52 208 51 228 50 250M146 188C148 208 149 228 150 250" fill="none" stroke="#5aa3d6" stroke-width="1.2"/>`,
  front: `<g class="ms-braid" fill="url(#sora-hair)" stroke="#151929" stroke-width=".9">
      <ellipse cx="138" cy="144" rx="6" ry="7.8"/><ellipse cx="139" cy="157" rx="5.8" ry="7.6"/><ellipse cx="140" cy="169" rx="5.4" ry="7.2"/><ellipse cx="141" cy="181" rx="4.8" ry="6.4"/>
      <path d="M139 189q-3 8 0 12q3-4 4-12z"/>
      <rect x="136.5" y="186" width="9" height="3.4" rx="1.6" fill="#ffcf5a" stroke="#d9a42e"/>
    </g>`,
  accessory: `<g transform="translate(72 58)"><g stroke="#f0a92a" stroke-width="1.2" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => `<path transform="rotate(${a})" d="M0 -6.4V-8.8"/>`)
    .join('')}</g><circle r="4.6" fill="#ffd45e" stroke="#e59e1f" stroke-width=".8"/><path d="M-1.8 -.6h.01M1.8 -.6h.01" stroke="#9a5a12" stroke-width="1.2" stroke-linecap="round"/><path d="M-1.6 1.4Q0 2.8 1.6 1.4" fill="none" stroke="#9a5a12" stroke-width=".8"/></g>`,
};

/**
 * 蕾西亚 — an original hIE in the visual language of BEATLESS: lavender-silver
 * long hair, ice-blue eyes, a white/black bodysuit with a thin ice-blue seam,
 * and a fragment of a black monolith floating behind her shoulder.
 * This is a homage, NOT a reproduction of the official character design.
 */
const LACIA: Look = {
  id: 'lacia',
  hair: ['#e2d9f6', '#b0a0dd', '#7d68bb'],
  hairHi: '#fbf8ff',
  iris: ['#1f4c86', '#4d9bd8', '#d3f1ff'],
  pupil: '#0b1a2e',
  lash: '#241d38',
  backW: [41, 49, 57],
  bangs: [[63, 66], [86, 60], [110, 60], [137, 67]],
  behind: `<g class="ms-monolith">
      <path d="M158 22L188 10L194 200L164 214Z" fill="#14151f" stroke="#2b2d42" stroke-width="1"/>
      <path d="M166 34L184 26L189 190L171 200Z" fill="#1b1c29"/>
      <path d="M177 46L179 184" stroke="#9ed8ff" stroke-width="1.4" opacity=".9"/>
      <path d="M158 22L164 214" stroke="#9ed8ff" stroke-width=".7" opacity=".3"/>
      <g fill="#cfe8ff" opacity=".85"><circle cx="153" cy="74" r="1.7"/><circle cx="146" cy="108" r="1.1"/><circle cx="160" cy="136" r="1.3"/></g>
    </g>`,
  outfitBase: '#f8f8fc',
  outfit: `<path d="${BODY}" fill="#f8f8fc" stroke="#c8c9d8" stroke-width="1"/>
      <path d="M47 168C41 180 37 198 34 250H50C51 214 55 186 63 165Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M153 168C159 180 163 198 166 250H150C149 214 145 186 137 165Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M89 148C93 143 107 143 111 148L109 165C103 161 97 161 91 165Z" fill="#171826" stroke="#0d0e18" stroke-width="1" stroke-linejoin="round"/>
      <path d="M100 164V250" stroke="#9ed8ff" stroke-width="1.5" opacity=".9"/>
      <path d="M100 190L107 201L100 212L93 201Z" fill="none" stroke="#9ed8ff" stroke-width="1.3"/>
      <path d="M84 160Q92 168 100 162Q108 168 116 160" fill="none" stroke="#9ed8ff" stroke-width=".9" opacity=".5"/>
      <path d="M64 238Q68 246 66 250M136 238Q132 246 134 250" fill="none" stroke="#c8c9d8" stroke-width="1.2"/>`,
  accessory: `<g transform="translate(129 58)"><path d="M0 0L8-5L16 0L8 5Z" fill="#171826" stroke="#9ed8ff" stroke-width=".9"/><path d="M8-5V5" stroke="#9ed8ff" stroke-width=".6" opacity=".75"/></g>`,
};

const SVGS: Record<MascotId, string> = { chibi: CHIBI, haru: bust(HARU), sora: bust(SORA), lacia: bust(LACIA) };

export function mascotSvg(id: string): string {
  return SVGS[isMascotId(id) ? id : 'haru'];
}

/** Kept for callers that only need the default artwork. */
export const MASCOT_SVG = SVGS.haru;

export const MASCOT_LINES: Record<MascotId, string[]> = {
  chibi: ['今天也一起读一点吧。', '累了就看看窗外的云。', '这篇写得真好，慢慢读～', '记得喝水哦。', '有不懂的地方，记下来就好。', '我在这里陪你。'],
  haru: [
    '樱花开了呢。今天想读哪一篇？',
    '慢慢读就好，我不着急的。',
    '这一段我也很喜欢。',
    '读累了的话，抬头看看窗外吧。',
    '把想到的写下来，以后会感谢现在的自己哦。',
    '风有点大……花瓣都飘进来了。',
    '嗯？要拖我去哪里呀？',
  ],
  sora: [
    '雨快停了，等一下就会放晴的。',
    '你看，云的缝隙里有光。',
    '下雨天最适合读书了。',
    '要不要一起等晴天？',
    '我的伞很大，借你一半。',
    '今天的你，也辛苦了。',
    '把我放在哪儿都可以，我会乖乖待着。',
  ],
  lacia: [
    '你回来了。……契约仍然有效。',
    '我不是人类。但我在听。',
    '如果我说我有心，你会害怕吗？',
    '今天还剩多少工作？我可以等。',
    '不必对我客气。我是你的道具。',
    '你的笑容，我记住了。',
    '没有心跳，也能听见你。',
    '把重要的东西交给我吧。我会守好。',
  ],
};
