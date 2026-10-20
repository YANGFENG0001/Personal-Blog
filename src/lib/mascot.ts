/**
 * The site's original mascots ("看板娘"), drawn as inline SVG so they need no
 * image request. All characters are original designs.
 *
 * - chibi: the first, simple chibi girl (kept for the 夏日物语 preset).
 * - haru:  an anime-style bust — long chestnut hair, sakura hairpin, sailor uniform.
 * - sora:  an anime-style bust — dark bob with a side braid, sun hairclip,
 *          sky-blue raincoat and a clear umbrella over her shoulder.
 *
 * The anime busts use layered gradients and line art (hair outline, lashes,
 * double-lid line, iris gradient with highlights, hatched blush) instead of
 * flat cartoon shapes. Class names (ms-*) drive the CSS animations: breathing,
 * hair sway, blinking, eye-follow and a happy face while talking.
 */

export type MascotId = 'chibi' | 'haru' | 'sora';

export const MASCOTS: { id: MascotId; name: string; desc: string }[] = [
  { id: 'haru', name: '小春', desc: '樱色发卡、长发、水手服，安静地陪你读书。' },
  { id: 'sora', name: '小晴', desc: '短发侧辫、太阳发夹，撑着透明雨伞的晴天少女。' },
  { id: 'chibi', name: 'Q 版', desc: '最初的 Q 版夏日制服少女。' },
];

export function isMascotId(id: string): id is MascotId {
  return MASCOTS.some((m) => m.id === id);
}

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

interface Look {
  id: 'haru' | 'sora';
  hair: [string, string, string];
  hairHi: string;
  iris: [string, string, string];
  pupil: string;
  lash: string;
  backHair: string;
  locks: [string, string];
  outfit: string;
  outfitBase: string;
  accessory: string;
  behind?: string;
  front?: string;
}

const SKIN = { base: '#ffeade', low: '#fcd9c9', shade: '#f2bfae', line: '#d99a88' };

/** One eye, drawn on the left; the right eye is the same group mirrored. */
function eye(L: Look, side: 'l' | 'r'): string {
  const clip = `${L.id}-eye-${side}`;
  const white = 'M72 118 Q80 108 96 114 Q97 128 87 134 Q76 133 72 118Z';
  return `<clipPath id="${clip}"><path d="${white}"/></clipPath>
    <path d="${white}" fill="#fff"/>
    <g clip-path="url(#${clip})"><g class="ms-iris ms-iris-${side}">
      <ellipse cx="85" cy="123" rx="8.6" ry="11.2" fill="url(#${L.id}-iris)"/>
      <ellipse cx="85" cy="125" rx="4" ry="5.6" fill="${L.pupil}"/>
      <path d="M78.5 129 Q85 134.5 91.5 129" fill="none" stroke="${L.iris[2]}" stroke-width="1.6" opacity=".85"/>
      <ellipse cx="81.6" cy="117.6" rx="3.1" ry="3.7" fill="#fff"/>
      <circle cx="89.2" cy="128" r="1.5" fill="#fff" opacity=".9"/>
    </g><path d="M70 112 Q84 104 98 112 V119 Q84 112 70 120Z" fill="${L.iris[0]}" opacity=".28"/></g>
    <path d="M69 117 Q80 103 98 112 L97.4 115.6 Q81 108 72.6 120.4Z" fill="${L.lash}"/>
    <path d="M70.4 116 L63.6 111.6 L71.6 119.2Z" fill="${L.lash}"/>
    <path d="M76 107.6 Q86 102.6 95 106.4" fill="none" stroke="${L.lash}" stroke-width=".9" opacity=".55"/>
    <path d="M80 133.6 Q86 135.2 92 131.2" fill="none" stroke="${L.lash}" stroke-width="1" opacity=".6"/>`;
}

function bust(L: Look): string {
  const id = L.id;
  const mirror = 'matrix(-1 0 0 1 200 0)';
  const bangs =
    'M62 112 C56 56 144 56 138 112 Q130 90 126 114 Q122 92 116 108 Q112 88 104 120 Q100 92 94 110 Q90 88 82 116 Q78 92 72 108 Q68 94 62 112Z';
  const happy = '<path d="M74 125 Q84 114 95 124" fill="none" stroke-width="2.6" stroke-linecap="round"/>';
  return `<svg class="mascot-svg ms-anime" viewBox="0 0 200 250" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.hair[0]}"/><stop offset=".55" stop-color="${L.hair[1]}"/><stop offset="1" stop-color="${L.hair[2]}"/></linearGradient>
    <linearGradient id="${id}-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.iris[0]}"/><stop offset=".55" stop-color="${L.iris[1]}"/><stop offset="1" stop-color="${L.iris[2]}"/></linearGradient>
    <linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKIN.base}"/><stop offset="1" stop-color="${SKIN.low}"/></linearGradient>
    <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".84" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="${id}-mask" maskUnits="userSpaceOnUse" x="-40" y="-40" width="280" height="290"><rect x="-40" y="-40" width="280" height="290" fill="url(#${id}-fade)"/></mask>
  </defs>
  <g mask="url(#${id}-mask)">
    ${L.behind ?? ''}
    <g class="ms-breath">
      <path d="${L.backHair}" fill="url(#${id}-hair)" stroke="${L.hair[2]}" stroke-width="1"/>
      <path d="M91 148 L91 182 Q100 188 109 182 L109 148Z" fill="url(#${id}-skin)"/>
      <path d="M91 156 Q100 170 109 156 L109 166 Q100 176 91 166Z" fill="${SKIN.shade}" opacity=".75"/>
      <g transform="translate(0 -9)">${L.outfit}<rect x="40" y="244" width="120" height="20" fill="${L.outfitBase}"/></g>
      ${L.front ?? ''}
      <g class="ms-head">
        <path d="M66 98 C66 130 78 152 100 166 C122 152 134 130 134 98 C134 62 66 62 66 98Z" fill="url(#${id}-skin)" stroke="${SKIN.line}" stroke-width=".9"/>
        <path d="M68 104 Q84 120 99 112 Q114 122 132 104 L132 113 Q114 130 99 121 Q84 128 68 113Z" fill="${SKIN.shade}" opacity=".45"/>
        <g class="ms-eyes">
          <g>${eye(L, 'l')}</g>
          <g transform="${mirror}">${eye(L, 'r')}</g>
        </g>
        <g class="ms-happy" stroke="${L.lash}">${happy}<g transform="${mirror}">${happy}</g></g>
        <path d="M101 137 Q102.6 140.6 100 141.8" fill="none" stroke="${SKIN.line}" stroke-width="1.1" stroke-linecap="round"/>
        <path class="ms-mouth-idle" d="M95 150 Q100 153.4 105 150" fill="none" stroke="#c0646e" stroke-width="1.4" stroke-linecap="round"/>
        <path class="ms-mouth-talk" d="M95 149 Q100 158 105 149 Q100 151.4 95 149Z" fill="#c25a6a"/>
        <g class="ms-cheeks">
          <ellipse cx="78" cy="139" rx="7.5" ry="3.4" fill="#ff9fb3" opacity=".38"/><ellipse cx="122" cy="139" rx="7.5" ry="3.4" fill="#ff9fb3" opacity=".38"/>
          <path d="M73.5 141 l2.6 -3.8 M77.5 141 l2.6 -3.8 M81.5 141 l2.6 -3.8 M117.5 141 l2.6 -3.8 M121.5 141 l2.6 -3.8 M125.5 141 l2.6 -3.8" stroke="#ee7890" stroke-width=".9" opacity=".7"/>
        </g>
        <path class="ms-lock" d="${L.locks[0]}" fill="url(#${id}-hair)" stroke="${L.hair[2]}" stroke-width="1"/>
        <path class="ms-lock ms-lock-r" d="${L.locks[1]}" fill="url(#${id}-hair)" stroke="${L.hair[2]}" stroke-width="1"/>
        <path d="${bangs}" fill="url(#${id}-hair)" stroke="${L.hair[2]}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M100 64 Q104 92 104 118 M86 68 Q84 94 82 114 M114 68 Q119 92 116 106 M74 76 Q71 92 72 106 M126 76 Q129 92 126 112" fill="none" stroke="${L.hair[2]}" stroke-width=".9" opacity=".55"/>
        <path d="M76 80 Q88 72 98 71 M103 71 Q114 72 124 80" fill="none" stroke="${L.hairHi}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/><path d="M80 83 Q86 79 92 78 M108 78 Q114 79 120 83" fill="none" stroke="${L.hairHi}" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>
        <path d="M74 100.6 Q84 96.6 94 100.6 M106 100.6 Q116 96.6 126 100.6" fill="none" stroke="${L.hair[2]}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
        ${L.accessory}
      </g>
    </g>
  </g>
</svg>`;
}

const sakuraFlower = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288]
    .map((a) => `<path transform="rotate(${a})" d="M0 0 C-4.4 -4 -3.6 -10.4 -1 -11.6 L0 -10 L1 -11.6 C3.6 -10.4 4.4 -4 0 0Z" fill="#ffd0e0" stroke="#ee8aaa" stroke-width=".6"/>`)
    .join('')}<circle r="1.9" fill="#ffd877"/></g>`;

const HARU: Look = {
  id: 'haru',
  hair: ['#7a4c3e', '#553429', '#35201b'],
  hairHi: '#e3b39a',
  iris: ['#4b2443', '#a5527c', '#f4abc6'],
  pupil: '#2a1024',
  lash: '#2d1a1f',
  backHair: 'M58 92 C40 150 46 206 32 250 H168 C154 206 160 150 142 92 C140 46 60 46 58 92Z',
  locks: [
    'M66 94 C57 130 63 168 54 232 C61 214 66 196 69 178 C71 150 72 122 75 104Z',
    'M134 94 C143 130 137 168 146 232 C139 214 134 196 131 178 C129 150 128 122 125 104Z',
  ],
  outfitBase: '#f6f7fc',
  outfit: `<path d="M46 250 C48 214 60 199 84 191 L116 191 C140 199 152 214 154 250Z" fill="#f6f7fc" stroke="#c9cfe0" stroke-width="1"/>
      <path d="M60 222 Q66 236 64 250 M140 222 Q134 236 136 250" fill="none" stroke="#d5dbea" stroke-width="1.4"/>
      <path d="M83 190 L100 222 L117 190 L133 196 C146 202 152 211 154 220 L114 226 L100 240 L86 226 L46 220 C48 211 54 202 67 196Z" fill="#2b3a67" stroke="#1d2850" stroke-width="1"/>
      <path d="M69 200 C58 205 53 211 51 216 M131 200 C142 205 147 211 149 216 M88 223 L100 235 L112 223" fill="none" stroke="#fff" stroke-width="1.5"/>
      <path d="M100 222 L84 214 Q80 225 87 230Z M100 222 L116 214 Q120 225 113 230Z" fill="#e2577f" stroke="#b83a62" stroke-width=".8"/>
      <path d="M100 222 L91 244 L97 244Z M100 222 L109 244 L103 244Z" fill="#d84a73"/>
      <ellipse cx="100" cy="222" rx="4.2" ry="3.6" fill="#c93f68"/>`,
  accessory: sakuraFlower(125, 84, 1) + sakuraFlower(133, 93, 0.62),
};

const SORA: Look = {
  id: 'sora',
  hair: ['#3a4566', '#232a42', '#141828'],
  hairHi: '#9cc2f2',
  iris: ['#173563', '#3f8fd8', '#a6e6ff'],
  pupil: '#0d1830',
  lash: '#161a2a',
  backHair: 'M60 92 C50 140 54 168 50 196 C72 204 128 204 150 196 C146 168 150 140 140 92 C138 46 62 46 60 92Z',
  locks: [
    'M66 94 C58 124 62 150 58 182 C64 172 68 160 70 150 C71 132 72 116 75 104Z',
    'M134 94 C142 124 138 150 142 182 C136 172 132 160 130 150 C129 132 128 116 125 104Z',
  ],
  behind: `<g class="ms-umb" transform="rotate(-20 100 130)">
      <path d="M100 96 V236" stroke="#b9c3d2" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M6 98 Q100 -14 194 98 Q170 89 147 98 Q124 89 100 98 Q76 89 53 98 Q30 89 6 98Z" fill="#e6f3ff" fill-opacity=".3" stroke="#fff" stroke-opacity=".85" stroke-width="1.4"/>
      <path d="M100 28 V98 M100 28 Q70 46 53 98 M100 28 Q130 46 147 98 M100 28 Q42 54 6 98 M100 28 Q158 54 194 98" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>
      <g fill="#fff" opacity=".8"><circle cx="58" cy="60" r="1.6"/><circle cx="132" cy="50" r="1.3"/><circle cx="160" cy="76" r="1.8"/><circle cx="84" cy="44" r="1.1"/><circle cx="34" cy="84" r="1.2"/></g>
      <path d="M100 26 V20" stroke="#b9c3d2" stroke-width="2" stroke-linecap="round"/>
    </g>`,
  outfitBase: '#7cc0ec',
  outfit: `<path d="M44 250 C46 214 60 197 86 189 L114 189 C140 197 154 214 156 250Z" fill="#7cc0ec" stroke="#4f97c9" stroke-width="1"/>
      <path d="M62 184 C68 172 86 168 100 172 C114 168 132 172 138 184 C130 196 70 196 62 184Z" fill="#5fa9dc" stroke="#3f88bc" stroke-width="1"/>
      <path d="M88 189 Q100 199 112 189 L109 196 Q100 204 91 196Z" fill="#fbfcff"/>
      <path d="M100 200 V250" stroke="#3f88bc" stroke-width="1.6"/>
      <path d="M92 196 v22 M108 196 v22" stroke="#f4f6fb" stroke-width="1.3"/><circle cx="92" cy="219" r="1.8" fill="#f4f6fb"/><circle cx="108" cy="219" r="1.8" fill="#f4f6fb"/>
      <path d="M58 226 Q62 238 60 250 M142 226 Q138 238 140 250" fill="none" stroke="#5aa3d6" stroke-width="1.4"/>`,
  front: `<g class="ms-braid" fill="url(#sora-hair)" stroke="#141828" stroke-width=".9">
      <ellipse cx="139" cy="150" rx="6.2" ry="8"/><ellipse cx="140" cy="163" rx="6" ry="7.8"/><ellipse cx="141" cy="176" rx="5.6" ry="7.4"/><ellipse cx="142" cy="188" rx="5" ry="6.6"/>
      <path d="M140 196 q-3 8 0 12 q3 -4 4 -12z"/>
      <rect x="137.5" y="193" width="9" height="3.4" rx="1.6" fill="#ffcf5a" stroke="#d9a42e"/>
    </g>`,
  accessory: `<g transform="translate(76 86)"><g stroke="#f0a92a" stroke-width="1.2" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => `<path transform="rotate(${a})" d="M0 -6.4 V-8.8"/>`)
    .join('')}</g><circle r="4.6" fill="#ffd45e" stroke="#e59e1f" stroke-width=".8"/><path d="M-1.8 -.6 h.01 M1.8 -.6 h.01" stroke="#9a5a12" stroke-width="1.2" stroke-linecap="round"/><path d="M-1.6 1.4 Q0 2.8 1.6 1.4" fill="none" stroke="#9a5a12" stroke-width=".8"/></g>`,
};

const SVGS: Record<MascotId, string> = { chibi: CHIBI, haru: bust(HARU), sora: bust(SORA) };

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
};
