/**
 * Immersive background scenes. Each scene is a static, server-rendered stack
 * of SVG layers (sky gradient is CSS) plus a light canvas particle effect.
 * Colours come from CSS variables using light-dark(), so one markup serves
 * day and night. Motion is CSS transform-only on a handful of layers and is
 * disabled with the site's motion setting / prefers-reduced-motion.
 */

export type SceneId = 'ocean' | 'forest' | 'meadow' | 'nightsky' | 'summer';

export const SCENES: { id: SceneId; name: string; effect: string; desc: string }[] = [
  { id: 'ocean', name: '蔚蓝海面', effect: 'glints', desc: '晴空、远岛、帆影与起伏的海浪；夜晚是月光海面。' },
  { id: 'forest', name: '晨雾森林', effect: 'motes', desc: '层叠松林、薄雾与林间光束；夜晚萤火点点。' },
  { id: 'meadow', name: '风吹草原', effect: 'seeds', desc: '流云、起伏山丘与随风摇曳的草；蒲公英飘过。' },
  { id: 'nightsky', name: '银河星夜', effect: 'nightsky', desc: '银河、群山剪影与偶尔划过的流星。' },
  { id: 'summer', name: '夏日物语', effect: 'summer', desc: '积雨云、海边小镇与电车；夜里有远处的烟花。' },
];

export function getScene(id: string) {
  return SCENES.find((s) => s.id === id);
}

/* ---------------- deterministic shape helpers ---------------- */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** A seamless wave band two periods wide (for a -50% translate loop). */
function wave(y: number, amp: number, period: number, width = 2880, bottom = 400): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < width; x += period) {
    d += ` q${period / 4} ${-amp} ${period / 2} 0 t${period / 2} 0`;
  }
  return `${d} V${bottom} H0Z`;
}

/** Smooth ridge from a sum of sines, closed to the bottom. */
function ridge(base: number, amps: [number, number][], seed: number, width = 1440, bottom = 400, step = 24): string {
  const r = rng(seed);
  const ph = amps.map(() => r() * Math.PI * 2);
  const y = (x: number) => base + amps.reduce((acc, [a, p], i) => acc + a * Math.sin((x / p) * Math.PI * 2 + ph[i]!), 0);
  let d = `M0 ${y(0).toFixed(1)}`;
  for (let x = step; x <= width; x += step) d += ` L${x} ${y(x).toFixed(1)}`;
  return `${d} V${bottom} H0Z`;
}

function ridgeY(base: number, amps: [number, number][], seed: number) {
  const r = rng(seed);
  const ph = amps.map(() => r() * Math.PI * 2);
  return (x: number) => base + amps.reduce((acc, [a, p], i) => acc + a * Math.sin((x / p) * Math.PI * 2 + ph[i]!), 0);
}

/** Pine silhouettes standing on a ridge. */
function pines(yAt: (x: number) => number, count: number, h: [number, number], seed: number, width = 1440): string {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = (i + r() * 0.8) * (width / count);
    const ht = h[0] + r() * (h[1] - h[0]);
    const w = ht * 0.32;
    const b = yAt(x) + 6;
    // three stacked tiers for a fir shape
    d += `M${x.toFixed(1)} ${(b - ht).toFixed(1)}`;
    for (const [t, ww] of [[0.38, 0.55], [0.68, 0.8], [1, 1]] as const) {
      d += ` L${(x + w * ww).toFixed(1)} ${(b - ht + ht * t).toFixed(1)} L${(x + w * ww * 0.45).toFixed(1)} ${(b - ht + ht * t).toFixed(1)}`;
    }
    d += ` L${(x - w * 0.45).toFixed(1)} ${b.toFixed(1)}`;
    for (const [t, ww] of [[1, 1], [0.68, 0.8], [0.38, 0.55]] as const) {
      d += ` L${(x - w * ww * 0.45).toFixed(1)} ${(b - ht + ht * t).toFixed(1)} L${(x - w * ww).toFixed(1)} ${(b - ht + ht * t).toFixed(1)}`;
    }
    d += 'Z';
  }
  return d;
}

/** Grass blades along the bottom edge. */
function blades(count: number, h: [number, number], seed: number, width = 1440, bottom = 400): string {
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = r() * width;
    const ht = h[0] + r() * (h[1] - h[0]);
    const lean = (r() - 0.35) * ht * 0.5;
    const w = 2 + r() * 3;
    d += `M${(x - w).toFixed(1)} ${bottom} Q${(x + lean * 0.3).toFixed(1)} ${(bottom - ht * 0.6).toFixed(1)} ${(x + lean).toFixed(1)} ${(bottom - ht).toFixed(1)} Q${(x + lean * 0.3 + w).toFixed(1)} ${(bottom - ht * 0.55).toFixed(1)} ${(x + w).toFixed(1)} ${bottom}Z`;
  }
  return d;
}

/** A soft cumulus made of overlapping circles. */
function cloud(cx: number, cy: number, s: number, seed: number, cls: string, shadow: string): string {
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    puffs.push([cx + (t - 0.5) * 220 * s, cy - Math.sin(t * Math.PI) * 46 * s - r() * 14 * s, (28 + Math.sin(t * Math.PI) * 30 + r() * 10) * s]);
  }
  const base = `<ellipse cx="${cx}" cy="${cy + 8 * s}" rx="${120 * s}" ry="${22 * s}"/>`;
  const shade = puffs.map(([x, y, rr]) => `<circle cx="${(x + 6 * s).toFixed(1)}" cy="${(y + 10 * s).toFixed(1)}" r="${rr.toFixed(1)}"/>`).join('');
  const body = puffs.map(([x, y, rr]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}"/>`).join('');
  return `<g class="${shadow}">${shade}${base}</g><g class="${cls}">${body}<ellipse cx="${cx}" cy="${cy}" rx="${116 * s}" ry="${20 * s}"/></g>`;
}

const svg = (cls: string, body: string, vb = '0 0 1440 400', par = 'xMidYMax slice') =>
  `<svg class="sc-layer ${cls}" viewBox="${vb}" preserveAspectRatio="${par}" aria-hidden="true" focusable="false">${body}</svg>`;

/* ---------------- scenes ---------------- */

function ocean(): string {
  const gulls = [[980, 120, 1], [1030, 100, 0.8], [1070, 132, 0.7]]
    .map(([x, y, s]) => `<path class="sc-gull" transform="translate(${x} ${y}) scale(${s})" d="M0 0 q9 -9 18 0 q9 -9 18 0"/>`)
    .join('');
  return [
    '<div class="sc-sun"></div>',
    svg('sc-far', `<path class="o-isle2" d="M760 252 q40 -26 80 -14 q30 -18 60 2 q24 -6 46 12Z"/><path class="o-isle" d="M180 252 q60 -48 130 -30 q40 -26 90 -4 q36 -10 70 34Z"/><path class="o-isle2" d="M1180 252 q30 -16 70 -6 q20 -10 40 6Z"/>`),
    svg('sc-sea', `<rect class="o-sea" x="0" y="250" width="1440" height="150"/><path class="o-horizon" d="M0 250 H1440" />`),
    svg('sc-sail', `<g transform="translate(560 252)"><g class="o-boat"><path class="o-hull" d="M0 0 h46 l-7 9 h-32z"/><path class="o-sail1" d="M22 -2 V-48 L44 -6Z"/><path class="o-sail2" d="M20 -4 V-40 L4 -6Z"/></g></g>`, '0 0 1440 400'),
    svg('sc-gulls', gulls),
    svg('sc-wave sc-w1', `<path class="o-w1" d="${wave(290, 6, 180)}"/>`),
    svg('sc-wave sc-w2', `<path class="o-w2" d="${wave(318, 9, 240)}"/>`),
    svg('sc-wave sc-w3', `<path class="o-w3" d="${wave(350, 12, 320)}"/><path class="o-foam" d="${wave(350, 12, 320).replace(/ V400 H0Z$/, '')}" />`),
  ].join('');
}

function forest(): string {
  const y2 = ridgeY(250, [[18, 700], [8, 260]], 7);
  const y3 = ridgeY(290, [[14, 520], [10, 180]], 11);
  const y4 = ridgeY(334, [[12, 420], [8, 150]], 19);
  return [
    '<div class="sc-rays"><i></i><i></i><i></i><i></i></div>',
    svg('sc-far', `<path class="f-m1" d="${ridge(214, [[26, 900], [12, 320]], 3)}"/><path class="f-p1" d="${pines(ridgeY(214, [[26, 900], [12, 320]], 3), 46, [24, 40], 5)}"/>`),
    svg('sc-mist sc-mist1', '<rect class="f-mist" x="0" y="200" width="1440" height="90"/>'),
    svg('sc-mid', `<path class="f-m2" d="${ridge(250, [[18, 700], [8, 260]], 7)}"/><path class="f-p2" d="${pines(y2, 34, [44, 70], 9)}"/>`),
    svg('sc-mist sc-mist2', '<rect class="f-mist" x="0" y="250" width="1440" height="90"/>'),
    svg('sc-near', `<path class="f-m3" d="${ridge(290, [[14, 520], [10, 180]], 11)}"/><path class="f-p3" d="${pines(y3, 22, [80, 120], 13)}"/>`),
    svg('sc-front', `<path class="f-m4" d="${ridge(334, [[12, 420], [8, 150]], 19)}"/><path class="f-p4" d="${pines(y4, 9, [150, 220], 23)}"/>`),
  ].join('');
}

function meadow(): string {
  const yh = ridgeY(250, [[22, 1100], [8, 400]], 31);
  const tx = 1060;
  const ty = yh(tx);
  const tree = `<g class="m-tree"><path class="m-trunk" d="M${tx - 3} ${ty + 4} q2 -26 1 -44 h6 q-2 18 1 44z"/><circle class="m-crown" cx="${tx}" cy="${ty - 56}" r="26"/><circle class="m-crown" cx="${tx - 20}" cy="${ty - 44}" r="18"/><circle class="m-crown" cx="${tx + 20}" cy="${ty - 46}" r="19"/><circle class="m-crown-hi" cx="${tx - 6}" cy="${ty - 64}" r="12"/></g>`;
  return [
    '<div class="sc-sun sc-sun-soft"></div>',
    `<div class="sc-clouds">${svg('', cloud(260, 120, 0.7, 41, 'm-cloud', 'm-cloud-sh') + cloud(820, 90, 0.55, 43, 'm-cloud', 'm-cloud-sh') + cloud(1280, 140, 0.6, 47, 'm-cloud', 'm-cloud-sh'), '0 0 1440 400', 'xMidYMin slice')}</div>`,
    svg('sc-far', `<path class="m-h1" d="${ridge(222, [[16, 900], [6, 300]], 29)}"/>`),
    svg('sc-mid', `<path class="m-h2" d="${ridge(250, [[22, 1100], [8, 400]], 31)}"/>${tree}`),
    svg('sc-near', `<path class="m-h3" d="${ridge(300, [[18, 800], [6, 260]], 37)}"/>`),
    svg('sc-grass sc-g1', `<path class="m-g1" d="${blades(220, [30, 70], 53)}"/>`),
    svg('sc-grass sc-g2', `<path class="m-g2" d="${blades(160, [46, 96], 59)}"/><g class="m-flowers">${[[120, 352], [410, 366], [690, 348], [930, 370], [1210, 356], [1360, 364]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</g>`),
  ].join('');
}

function nightsky(): string {
  return [
    '<div class="sc-milky"></div>',
    '<div class="sc-moon"></div>',
    svg('sc-far', `<path class="n-m1" d="${ridge(240, [[40, 700], [18, 230], [6, 90]], 61)}"/>`),
    svg('sc-mid', `<path class="n-m2" d="${ridge(286, [[34, 560], [14, 200], [5, 70]], 67)}"/>`),
    svg('sc-near', `<path class="n-m3" d="${ridge(336, [[20, 420], [8, 140]], 71)}"/><g class="n-tent"><path d="M1130 338 l26 -34 l26 34z"/><path class="n-glow" d="M1150 338 l6 -10 l6 10z"/></g>`),
  ].join('');
}

function summer(): string {
  const poles = [180, 560, 940, 1320];
  const wires = [0, 1, 2]
    .map((k) => {
      let d = '';
      for (let i = 0; i < poles.length - 1; i++) d += `M${poles[i]! + 14} ${148 + k * 8} Q${(poles[i]! + poles[i + 1]!) / 2} ${180 + k * 8} ${poles[i + 1]! - 14} ${148 + k * 8} `;
      return `<path class="s-wire" d="M-20 ${170 + k * 8} Q90 ${186 + k * 8} 166 ${148 + k * 8} ${d} M1334 ${148 + k * 8} Q1400 ${170 + k * 8} 1460 ${160 + k * 8}"/>`;
    })
    .join('');
  const poleSvg = poles.map((x) => `<path class="s-pole" d="M${x - 3} 400 V138 h6 V400z M${x - 22} 148 h44 v4 h-44z M${x - 16} 160 h32 v3 h-32z"/>`).join('');
  const r = rng(83);
  let houses = '';
  let windows = '';
  for (let x = -10; x < 1460; ) {
    const w = 40 + r() * 46;
    const h = 30 + r() * 34;
    const base = 330 + r() * 6;
    houses += `<path d="M${x} ${base} V${base - h} L${x + w / 2} ${base - h - 16 - r() * 10} L${x + w} ${base - h} V${base}Z"/>`;
    if (r() > 0.35) windows += `<rect x="${(x + w * 0.3).toFixed(1)}" y="${(base - h * 0.62).toFixed(1)}" width="7" height="8" rx="1"/>`;
    if (r() > 0.55) windows += `<rect x="${(x + w * 0.6).toFixed(1)}" y="${(base - h * 0.62).toFixed(1)}" width="7" height="8" rx="1"/>`;
    x += w + r() * 10;
  }
  const train = `<g class="s-train"><rect class="s-car" x="0" y="0" width="140" height="24" rx="7"/><rect class="s-car" x="146" y="0" width="140" height="24" rx="7"/><path class="s-stripe" d="M2 15 h136 M148 15 h136"/>${[0, 146]
    .map((o) => [14, 40, 66, 92, 118].map((wx) => `<rect class="s-win" x="${o + wx}" y="4" width="16" height="7" rx="2"/>`).join(''))
    .join('')}</g>`;
  return [
    '<div class="sc-sun sc-sun-summer"></div>',
    `<div class="sc-clouds sc-clouds-big">${svg('', cloud(300, 210, 1.25, 89, 's-cloud', 's-cloud-sh') + cloud(1120, 190, 1.05, 97, 's-cloud', 's-cloud-sh'), '0 0 1440 400', 'xMidYMax slice')}</div>`,
    svg('sc-far', `<rect class="s-sea" x="0" y="262" width="1440" height="30"/><path class="s-sea-hi" d="M0 264 H1440"/>`),
    svg('sc-mid', `<rect class="s-embank" x="0" y="292" width="1440" height="16"/><g class="s-train-track" transform="translate(0 268)">${train}</g>`),
    svg('sc-near', `<g class="s-town">${houses}</g><g class="s-lights">${windows}</g><rect class="s-ground" x="0" y="334" width="1440" height="66"/>`),
    svg('sc-front', `${poleSvg}${wires}`),
  ].join('');
}

const BUILDERS: Record<SceneId, () => string> = { ocean, forest, meadow, nightsky, summer };
const cache = new Map<SceneId, string>();

/** Static scene markup (server-rendered once, then cached). */
export function sceneHtml(id: SceneId): string {
  if (!cache.has(id)) cache.set(id, `<div class="scene" data-scene-id="${id}">${BUILDERS[id]()}</div>`);
  return cache.get(id)!;
}
