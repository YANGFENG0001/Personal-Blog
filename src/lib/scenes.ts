/**
 * Immersive background scenes. Each scene is a static, server-rendered stack
 * of SVG layers (sky gradient is CSS) plus a light canvas particle effect.
 * Colours come from CSS variables using light-dark(), so one markup serves
 * day and night. Motion is CSS transform-only on a handful of layers and is
 * disabled with the site's motion setting / prefers-reduced-motion.
 */

export type SceneId = 'ocean' | 'forest' | 'meadow' | 'nightsky' | 'summer' | 'sakura' | 'tenki' | 'lacia';

export const SCENES: { id: SceneId; name: string; effect: string; desc: string }[] = [
  { id: 'ocean', name: '蔚蓝海面', effect: 'glints', desc: '晴空、远岛、帆影与起伏的海浪；夜晚是月光海面。' },
  { id: 'forest', name: '晨雾森林', effect: 'motes', desc: '层叠松林、薄雾与林间光束；夜晚萤火点点。' },
  { id: 'meadow', name: '风吹草原', effect: 'seeds', desc: '流云、起伏山丘与随风摇曳的草；蒲公英飘过。' },
  { id: 'nightsky', name: '银河星夜', effect: 'nightsky', desc: '银河、群山剪影与偶尔划过的流星。' },
  { id: 'summer', name: '夏日物语', effect: 'summer', desc: '积雨云、海边小镇与电车；夜里有远处的烟花。' },
  { id: 'sakura', name: '樱花坂', effect: 'petals', desc: '日系动画风：通透蓝天与积雨云、坡下的校舍、踏切与电线，樱花纷飞；夜里是夜樱与道口的红灯。' },
  { id: 'tenki', name: '雨后晴空', effect: 'rain', desc: '《天气之子》风：雨中的东京天际线，云层破开一道阳光照进城市，屋顶的小鸟居；夜里霓虹映着雨。' },
  { id: 'lacia', name: '秘棺城市', effect: 'data', desc: '《BEATLESS》风：冷灰的城市天际线，尽头立着黑色秘棺，一道冰蓝的光缝亮着；数据光点向上飘，夜里只剩那道冷光。' },
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

/* ---------------- anime-style helpers ---------------- */

/**
 * Cel-shaded puffs, the way anime backgrounds paint clouds and foliage: the
 * whole silhouette in the shadow tone, a lit layer shifted towards the light
 * (top-left) and shrunk so shadow shows along the lower-right edges, then a few
 * small highlights on the top puffs. Flat fills, no per-puff gradients.
 */
function cel(puffs: [number, number, number][], prefix: string, ellipse = 1): string {
  const shape = (x: number, y: number, rr: number) =>
    ellipse === 1 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}"/>` : `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(rr * ellipse).toFixed(1)}" ry="${rr.toFixed(1)}"/>`;
  const sh = puffs.map(([x, y, rr]) => shape(x, y, rr)).join('');
  const lit = puffs.map(([x, y, rr]) => shape(x - rr * 0.14, y - rr * 0.2, rr * 0.8)).join('');
  const top = [...puffs].sort((a, b) => a[1] - a[2] - (b[1] - b[2])).slice(0, Math.max(2, Math.round(puffs.length * 0.3)));
  const hi = top.map(([x, y, rr]) => shape(x - rr * 0.3, y - rr * 0.42, rr * 0.38)).join('');
  return `<g class="${prefix}-sh">${sh}</g><g class="${prefix}-lit">${lit}</g><g class="${prefix}-hi">${hi}</g>`;
}

/** A towering cumulus: a wide flat base with puffs stacked into a tower. */
function puffCloud(cx: number, cy: number, s: number, seed: number, tower = 1): string {
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    puffs.push([cx + (t - 0.5) * 300 * s, cy - Math.sin(t * Math.PI) * 26 * s - r() * 8 * s, (20 + Math.sin(t * Math.PI) * 24 + r() * 10) * s]);
  }
  for (let i = 0; i < Math.round(8 * tower); i++) {
    const t = 0.2 + r() * 0.6;
    const lift = (0.3 + r() * 0.7) * tower;
    puffs.push([cx + (t - 0.5) * 230 * s * (1 - lift * 0.25), cy - (30 + lift * 80) * s, (24 + r() * 26) * s]);
  }
  // flat underside, as cumulus have
  const base = `<path class="cl-sh" d="M${cx - 160 * s} ${cy + 8 * s} Q${cx - 150 * s} ${cy - 20 * s} ${cx} ${cy - 18 * s} Q${cx + 150 * s} ${cy - 20 * s} ${cx + 160 * s} ${cy + 8 * s}Z"/>`;
  return base + cel(puffs, 'cl');
}

/** Clusters of blossom puffs forming a cherry canopy (cel-shaded). */
function blossoms(centers: [number, number, number][], seed: number): string {
  const r = rng(seed);
  const pts: [number, number, number][] = [];
  for (const [cx, cy, rad] of centers) {
    const n = Math.round(rad / 2.4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad;
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 6 + r() * 11]);
    }
  }
  return cel(pts, 'bl');
}

/** A tapered branch: a filled shape along a quadratic curve. */
function branch(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number): string {
  const k = (w0 + w1) / 4;
  return `<path class="k-bark" d="M${x0 - w0 / 2} ${y0} Q${cx - k} ${cy} ${x1 - w1 / 2} ${y1} L${x1 + w1 / 2} ${y1} Q${cx + k} ${cy} ${x0 + w0 / 2} ${y0}Z"/>`;
}

/**
 * 樱花坂 — a slope-side school town in spring, in the clear, high-contrast
 * style of Japanese anime backgrounds: towering lit cumulus, lens flare,
 * overhead power lines, a level crossing, and cherry trees framing the view.
 */
function sakura(): string {
  const r = rng(131);
  let city = '';
  for (let x = -10; x < 1450; ) {
    const w = 12 + r() * 26;
    const h = 6 + r() * (x > 480 && x < 900 ? 34 : 18);
    city += `<rect x="${x.toFixed(0)}" y="${(262 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 4).toFixed(0)}"/>`;
    x += w + r() * 3;
  }
  let houses = '';
  let roofs = '';
  for (let x = -20; x < 830; ) {
    const w = 34 + r() * 40;
    const b = 306 - (x / 830) * 12;
    const h = 16 + r() * 16;
    houses += `<rect x="${x.toFixed(0)}" y="${(b - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 2).toFixed(0)}"/>`;
    if (r() > 0.4) houses += `<rect class="k-hwin" x="${(x + w * 0.25).toFixed(0)}" y="${(b - h * 0.7).toFixed(0)}" width="8" height="6"/>`;
    roofs += `<path d="M${(x - 4).toFixed(0)} ${(b - h).toFixed(0)} L${(x + w / 2).toFixed(0)} ${(b - h - 10 - r() * 6).toFixed(0)} L${(x + w + 4).toFixed(0)} ${(b - h).toFixed(0)}Z"/>`;
    x += w + 2 + r() * 8;
  }
  let win = '';
  for (const row of [230, 254, 278]) {
    for (let x = 876; x < 1290; x += 24) if (x < 1044 || x > 1114) win += `<rect class="${r() > 0.5 ? 'w-on' : 'w-off'}" x="${x}" y="${row}" width="14" height="12" rx="1"/>`;
  }
  const fence = Array.from({ length: 56 }, (_, i) => `M${862 + i * 8} 204 V212`).join(' ');
  const school =
    `<g class="k-school"><rect class="k-wall" x="860" y="212" width="440" height="94"/><rect class="k-wall-sh" x="860" y="296" width="440" height="10"/>` +
    `<rect class="k-wall" x="1050" y="182" width="60" height="32"/><circle class="k-clock" cx="1080" cy="197" r="9"/><path class="k-hand" d="M1080 197 V191 M1080 197 L1085 199"/>` +
    `<rect class="k-roofline" x="856" y="210" width="448" height="4"/><path class="k-fence" d="M860 204 H1300 ${fence}"/><g class="k-win">${win}</g></g>`;
  const gym = '<path class="k-wall" d="M1316 306 V248 Q1380 216 1444 248 V306Z"/><path class="k-roofline" d="M1312 250 Q1380 212 1448 250 L1448 245 Q1380 207 1312 245Z"/>';
  const bushes = [[880, 306, 24], [940, 310, 20], [1000, 308, 24], [1180, 308, 22], [1250, 310, 26], [1330, 308, 22]]
    .map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`)
    .join('');
  const posts = Array.from({ length: 30 }, (_, i) => `M${330 + i * 38} 336 V352`).join(' ');
  const crossing =
    `<g class="k-cross"><rect class="k-pole2" x="146" y="232" width="7" height="168"/>` +
    `<g transform="translate(150 246)"><rect class="k-buck" x="-30" y="-5" width="60" height="10" transform="rotate(28)"/><rect class="k-buck" x="-30" y="-5" width="60" height="10" transform="rotate(-28)"/></g>` +
    `<rect class="k-pole2" x="128" y="276" width="44" height="5" rx="2"/><circle class="k-lamp k-lamp-a" cx="134" cy="290" r="7"/><circle class="k-lamp k-lamp-b" cx="166" cy="290" r="7"/></g>`;
  const wires = [0, 1, 2, 3]
    .map((k) => `<path class="k-wire" d="M-20 ${118 + k * 9} Q300 ${152 + k * 12} 560 ${112 + k * 7} Q900 ${150 + k * 10} 1240 ${108 + k * 8} Q1360 ${122 + k * 8} 1460 ${116 + k * 9}"/>`)
    .join('');
  const poles =
    [560, 1240].map((x) => `<path class="k-pole" d="M${x - 3.5} 400 V96 h7 V400z M${x - 26} 108 h52 v4 h-52z M${x - 20} 122 h40 v3 h-40z"/>`).join('') +
    '<rect class="k-pole" x="1246" y="140" width="15" height="26" rx="3"/>';
  const trees =
    branch(40, 400, 26, 300, 70, 168, 26, 9) + branch(60, 232, 120, 200, 172, 150, 10, 3) + branch(48, 262, 0, 220, -20, 190, 9, 3) +
    branch(1404, 400, 1414, 300, 1380, 180, 24, 8) + branch(1390, 238, 1330, 210, 1280, 172, 9, 3) +
    blossoms([[70, 160, 62], [150, 150, 46], [10, 198, 48], [112, 214, 40]], 137) +
    blossoms([[1380, 170, 58], [1300, 168, 40], [1430, 214, 44]], 139);
  const top =
    branch(-30, 10, 120, 40, 330, 30, 16, 3) + branch(120, 34, 170, 70, 220, 96, 6, 2) + branch(1470, 0, 1360, 40, 1210, 24, 12, 3) +
    blossoms([[60, 40, 52], [180, 46, 44], [290, 30, 30], [210, 92, 24]], 149) +
    blossoms([[1400, 34, 46], [1280, 28, 34]], 151);
  return [
    '<div class="sc-flare"><i></i><i></i><i></i><i></i></div>',
    `<div class="sc-clouds sc-clouds-big">${svg('', puffCloud(1130, 250, 1.3, 157, 1.6) + puffCloud(250, 210, 0.8, 163, 0.9) + puffCloud(700, 130, 0.4, 167, 0.5), '0 0 1440 400', 'xMidYMax slice')}</div>`,
    svg('sc-far', `<path class="k-hill" d="${ridge(250, [[12, 900], [5, 240]], 133)}"/><g class="k-city">${city}</g><rect class="k-haze" x="0" y="226" width="1440" height="44"/>`),
    svg('sc-mid', `<g class="k-houses">${houses}</g><g class="k-roofs">${roofs}</g>${school}${gym}<g class="k-bush">${bushes}</g>`),
    svg('sc-near', `<path class="k-road" d="M0 340 H1440 V400 H0Z"/><path class="k-curb" d="M0 340 H1440"/><path class="k-rail" d="M330 336 H1440 M330 344 H1440 ${posts}"/>${crossing}`),
    svg('sc-front', poles + wires + trees),
    svg('sc-top', top, '0 0 1440 300', 'xMidYMin slice'),
  ].join('');
}

/**
 * 雨后晴空 — after the film 天気の子: a rain-soaked Tokyo skyline under a heavy
 * cloud deck that breaks open, letting a shaft of sunlight fall on the city; a
 * small torii stands on a rooftop. At night the city glows with neon in the rain.
 */
function tenki(): string {
  const r = rng(211);
  // A heavy cloud deck of flattened puffs, with a hole the sun breaks through.
  // Its viewBox matches a typical desktop aspect (sliced, top-anchored), so the
  // hole sits near 70% across, under the CSS sunbeam.
  const hole = { x: 1010, y: 190, rx: 170, ry: 104 };
  const deck: [number, number, number][] = [];
  const rim: [number, number, number][] = [];
  for (let y = -30; y < 380; y += 26) {
    for (let x = -60; x < 1520; x += 52) {
      const jx = x + (r() - 0.5) * 40;
      const jy = y + (r() - 0.5) * 18;
      const rr = 22 + r() * 26;
      const edge = 290 + Math.sin(jx / 160) * 40 + Math.sin(jx / 53) * 16;
      if (jy > edge) continue;
      const d = ((jx - hole.x) / (hole.rx + rr * 0.6)) ** 2 + ((jy - hole.y) / (hole.ry + rr * 0.5)) ** 2;
      if (d < 1) continue;
      (d < 1.7 ? rim : deck).push([jx, jy, rr]);
    }
  }
  let far = '';
  for (let x = -10; x < 1450; ) {
    const w = 22 + r() * 44;
    const h = 30 + r() * (x > 560 && x < 900 ? 120 : 70);
    far += `<path d="M${x.toFixed(0)} 302 V${(300 - h).toFixed(0)} h${(w * 0.2).toFixed(1)} v-${(r() * 8).toFixed(1)} h${(w * 0.6).toFixed(1)} v${(r() * 8).toFixed(1)} h${(w * 0.2).toFixed(1)} V302Z"/>`;
    if (r() > 0.7) far += `<rect x="${(x + w / 2).toFixed(0)}" y="${(300 - h - 14).toFixed(0)}" width="1.5" height="14"/>`;
    x += w + r() * 6;
  }
  const tower =
    '<g class="t-tower"><path d="M268 302 L294 168 L296 150 L298 70 L300 40 L302 70 L304 150 L306 168 L332 302 L322 302 L301 186 L299 186 L278 302Z"/>' +
    '<rect x="288" y="164" width="24" height="7"/><rect x="293" y="120" width="14" height="5"/><path class="t-lattice" d="M283 240 L317 240 M287 214 L313 214 M291 192 L309 192 M280 272 L300 222 L320 272"/></g>';
  let mid = '';
  let winOn = '';
  let winOff = '';
  let signs = '';
  for (let x = -20; x < 1460; ) {
    const w = 40 + r() * 60;
    const h = 40 + r() * 70;
    const top = 340 - h;
    mid += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 4).toFixed(0)}"/>`;
    if (r() > 0.6) mid += `<rect x="${(x + w * 0.2).toFixed(0)}" y="${(top - 10).toFixed(0)}" width="${(w * 0.3).toFixed(0)}" height="10"/>`;
    for (let wy = top + 8; wy < 330; wy += 12) {
      for (let wx = x + 6; wx < x + w - 8; wx += 11) {
        const v = r();
        if (v < 0.35) continue;
        const cell = `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="6" height="6"/>`;
        if (v > 0.74) winOn += cell;
        else winOff += cell;
      }
    }
    if (r() > 0.72) signs += `<rect class="t-sign t-sign-${r() > 0.5 ? 'a' : 'b'}" x="${(x + w - 6).toFixed(0)}" y="${(top + 10).toFixed(0)}" width="8" height="${(20 + r() * 26).toFixed(0)}" rx="1.5"/>`;
    x += w + 2 + r() * 6;
  }
  const bars = Array.from({ length: 121 }, (_, i) => `M${i * 12} 336 V362`).join(' ');
  const torii =
    '<g class="t-torii"><rect class="t-ver" x="1150" y="296" width="8" height="66"/><rect class="t-ver" x="1206" y="296" width="8" height="66"/>' +
    '<path class="t-ver" d="M1130 292 Q1182 280 1234 292 L1232 300 Q1182 290 1132 300Z"/><rect class="t-ver-dk" x="1140" y="300" width="84" height="5"/><rect class="t-ver" x="1144" y="314" width="76" height="5"/>' +
    '<g class="t-shrine"><rect x="1170" y="334" width="24" height="28"/><path d="M1164 336 L1182 322 L1200 336Z"/></g></g>';
  const puddles = [[260, 382, 90, 7], [720, 390, 140, 6], [1060, 380, 70, 5]]
    .map(([x, y, rx, ry]) => `<ellipse class="t-puddle" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`)
    .join('');
  return [
    '<div class="sc-rainbow"></div>',
    '<div class="sc-beam"></div>',
    svg('sc-storm', cel(deck, 'dk', 1.7) + cel(rim, 'rm', 1.7), '0 0 1440 560', 'xMidYMin slice'),
    '<div class="sc-cityglow"></div>',
    svg('sc-far', `<g class="t-far">${far}</g>${tower}<rect class="t-haze" x="0" y="250" width="1440" height="54"/>`),
    svg('sc-mid', `<g class="t-mid">${mid}</g><g class="t-win-off">${winOff}</g><g class="t-win-on">${winOn}</g>${signs}`),
    svg('sc-near', `${torii}<path class="t-roof" d="M0 362 H1440 V400 H0Z"/>${puddles}<path class="t-rail" d="M0 336 H1440 M0 344 H1440 ${bars}"/>`),
  ].join('');
}

/**
 * 秘棺城市 — after BEATLESS.
 *
 * Two rules carry this picture, and neither one is "add more detail".
 *
 * **Depth is value, not detail.** Four ranks (far2 → far1 → mid → near) step
 * down in tone, and every block inside a rank picks one of three neighbouring
 * fills so the skyline never reads as a single cut-out. The first version used
 * one flat fill per rank, which is exactly why it looked like a sticker: with
 * no value separation there is no distance, and with no distance the eye has
 * nothing to look *into*.
 *
 * **The monolith is the subject, not a building.** It used to be 60 units wide
 * and 314 tall, sitting in the same row as the mid band — narrower than the
 * near blocks beside it, so it read as "one more tower". It is now a slab that
 * runs off the bottom of the frame and clears the skyline by a wide margin,
 * lit only by a rim on the side the bloom is on and a single glowing seam.
 * Everything else exists to give it scale: the ranks behind it, the parapet in
 * front of it, the aircraft above it.
 *
 * The camera stands on a roof — that is what the last layer is for. Without a
 * foreground the ranks read as stacked paper; with one, the eye gets a
 * distance from *here* to *there*, which is the whole trick of a background.
 */
function lacia(): string {
  const r = rng(307);
  const tone = () => `t${Math.floor(r() * 3)}`;

  /* ══ 这座城市是什么 ══════════════════════════════════════════════════════
   *
   * The previous version was a dark skyline with a 290-wide black tower in it.
   * That is a *mood*, not the place: it could be any cyberpunk backdrop, and
   * the tower was invented — canonically the Black Monolith is a device that
   * **floats behind her at roughly her own height**, not a building.
   *
   * What the source material actually shows, and what is drawn below:
   *
   *   · it is a **coastal** city — water, a horizon, and a lot of sky. That is
   *     the single strongest "this is that city" cue, and the old plate had
   *     none of it.
   *   · the architecture is **glass, banded horizontally**. Curtain wall, not
   *     punched windows: the dominant texture is a stack of thin even lines.
   *     This is also the reason the new plate reads *better* behind text than
   *     the old one did — horizontal bands are a lower spatial frequency than
   *     a random window grid at the same contrast.
   *   · an **elevated expressway** crosses the frame on tall piers. It is the
   *     one object that puts the camera at a known height above the water.
   *   · the palette is **high-key**: pale blue, white, a little lavender. The
   *     dark accent in the whole picture is the device.
   *
   * Readability is a constraint on top of that, not a compromise with it:
   * everything except the device stays under the veil and inside a narrow
   * value band, and the busy parts are kept out of the middle of the frame. */

  const HORIZON = 214;
  const SEA_BOTTOM = 268;

  /* ---- the bay ---- */
  const sea = `
    <rect class="l-sea" x="0" y="${HORIZON}" width="1440" height="${SEA_BOTTOM - HORIZON}"/>
    <path class="l-sea-path" d="M958 ${HORIZON} L1058 ${HORIZON} L1128 ${SEA_BOTTOM} L888 ${SEA_BOTTOM} Z"/>
    <rect class="l-sea-line" x="0" y="${HORIZON - 0.8}" width="1440" height="1.6"/>`;

  /* ---- far shore: a thin band of blocks sitting on the waterline ---- */
  let shore = '';
  for (let x = -20; x < 1470; ) {
    const w = 16 + r() * 46;
    const h = 10 + r() * 34;
    shore += `<rect class="${tone()}" x="${x.toFixed(0)}" y="${(HORIZON - h).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 3).toFixed(0)}"/>`;
    x += w + r() * 10;
  }

  /* ---- rank 2: the glass towers, with the curtain wall as a pattern ----
   *
   * One `<pattern>` per axis rather than a few hundred `<rect>`s: the bands are
   * what carry the material, and a pattern keeps the pitch exact across towers
   * of different heights. The vertical mullions are a second, much fainter
   * pattern so a tower face does not read as a barcode. */
  let towers = '';
  let towerBands = '';
  /* Two clusters, with the bay left open between them — a skyline that spans
     the whole frame has no distance in it, because nothing is in front. */
  const clusters: Array<[number, number]> = [
    [-30, 430],
    [880, 1480],
  ];
  for (const [from, to] of clusters) {
    for (let x = from; x < to; ) {
      const w = 46 + r() * 74;
      const h = 90 + r() * 150;
      const top = 400 - h;
      const t = tone();
      towers += `<rect class="${t}" x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 6).toFixed(0)}"/>`;
      /* Curtain wall. Two overlay rects per tower, both clipped to the tower's
         own box so the pattern never spills onto the sky. */
      const bandRect = (cls: string, x0: number, y0: number, w0: number, h0: number) =>
        `<rect x="${x0.toFixed(0)}" y="${y0.toFixed(0)}" width="${w0.toFixed(0)}" height="${h0.toFixed(0)}" fill="url(#${cls})"/>`;
      towerBands += bandRect('sc-lacia-cw', x, top, w, h + 6);
      towerBands += bandRect('sc-lacia-cwv', x, top, w, h + 6);
      /* One lit edge along the roof. Flat rectangles read as clip art no matter
         how good the palette is; a single lighter line turns each block into a
         volume under the same sky. */
      towers += `<rect class="rim" x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="1.2"/>`;
      /* Setback. Without them the roofline is a comb of equal bars. */
      if (r() > 0.5) {
        const sw = w * (0.42 + r() * 0.28);
        const sh = 16 + r() * 34;
        towers += `<rect class="${t}" x="${(x + (w - sw) / 2).toFixed(0)}" y="${(top - sh).toFixed(0)}" width="${sw.toFixed(0)}" height="${sh.toFixed(0)}"/>`;
        towerBands += bandRect('sc-lacia-cw', x + (w - sw) / 2, top - sh, sw, sh);
        towerBands += bandRect('sc-lacia-cwv', x + (w - sw) / 2, top - sh, sw, sh);
      }
      x += w + 6 + r() * 16;
    }
  }

  /* ---- the elevated expressway ----
   *
   * A shallow arc, not a straight bar: a straight deck at this angle reads as a
   * drawn line, while a 44-unit sag across the frame reads as something 400 m
   * long seen from the side. The piers are sampled off the same curve, so the
   * deck can never detach from them. */
  const DECK = { x0: -40, x1: 1480, y0: 332, y1: 314, cy: 288 };
  const deckY = (x: number) => {
    const t = (x - DECK.x0) / (DECK.x1 - DECK.x0);
    const u = 1 - t;
    return u * u * DECK.y0 + 2 * u * t * DECK.cy + t * t * DECK.y1;
  };
  const deckPath = `M${DECK.x0} ${DECK.y0} Q720 ${DECK.cy} ${DECK.x1} ${DECK.y1}`;
  let piers = '';
  for (let x = 90; x < 1440; x += 168) {
    const y = deckY(x);
    piers += `<rect class="xw-pier" x="${(x - 3.4).toFixed(1)}" y="${y.toFixed(1)}" width="6.8" height="${(400 - y).toFixed(1)}"/>`;
    piers += `<rect class="xw-foot" x="${(x - 7).toFixed(1)}" y="${(y + 6).toFixed(1)}" width="14" height="2.4"/>`;
  }
  const xway = `
    ${piers}
    <path class="xw-deck" d="${deckPath}" fill="none" stroke-width="7.5"/>
    <path class="xw-rail" d="${deckPath}" fill="none" stroke-width="1.5" transform="translate(0 -3.4)"/>
    <path class="xw-under" d="${deckPath}" fill="none" stroke-width="2.2" transform="translate(0 5.2)"/>`;

  /* ---- rank 3: near, low and wide, cropped by the parapet ---- */
  let near = '';
  for (let x = -40; x < 1500; ) {
    const w = 130 + r() * 210;
    const h = 30 + r() * 52;
    near += `<rect class="${tone()}" x="${x.toFixed(0)}" y="${(400 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>`;
    near += `<rect class="nrim" x="${x.toFixed(0)}" y="${(400 - h).toFixed(0)}" width="${w.toFixed(0)}" height="1.8"/>`;
    x += w + r() * 40;
  }

  /* ══ the black landmark ═════════════════════════════════════════════════
   *
   * This is the correction that matters most. The previous version put the
   * Black Monolith in the *sky* as a 290-wide slab running off the top of the
   * frame. Two things were wrong with that, and only one of them was scale:
   *
   *   · canonically the monolith is a **device that floats behind her at about
   *     her own height**, not a building. A second one hanging in the city
   *     backdrop is a duplicate of a thing the character already carries, and
   *     at 62 x 96 against a pale sky it read as a bug, not as a monument.
   *   · a slab with neither end visible only reads as monumental when there is
   *     a city around it to give it scale. Alone in the sky it reads as an
   *     unfinished rectangle.
   *
   * So it is now **architecture**: one black glass tower standing in the
   * right-hand cluster, cropped by the frame at the bottom, taller than
   * everything around it. It keeps the black accent the palette needs, it has
   * a roofline so the eye can measure it, and it belongs to the picture.
   *
   * Still unlit — no windows, no service lights. Every lit window on a black
   * slab turns it back into an office block, because windows are what
   * buildings have. Structure is carried by two cast joints and one seam. */
  /* Coffin plan, not a rectangle: the silhouette of the device the character
     carries, stood up as a building. A plain tapered slab at this width read as
     a scrollbar no matter how it was shaded — the chamfered shoulders are what
     make the shape recognisable in one glance, and they are the one thing that
     connects the backdrop to the character. */
  const MONO = { xL: 1288, xR: 1396, top: 206, chamfer: 15, side: 13 };
  const mono = `
    <defs>
      <linearGradient id="sc-lacia-mono-face" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" class="mf0"/><stop offset="0.55" class="mf1"/><stop offset="1" class="mf2"/>
      </linearGradient>
      <linearGradient id="sc-lacia-mono-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" class="ms0"/><stop offset="1" class="ms1"/>
      </linearGradient>
      <filter id="sc-lacia-soft" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4.2"/>
      </filter>
    </defs>
    <g class="l-mono">
      <path class="l-mono-side" d="M${MONO.xR} 400 L${MONO.xR} ${MONO.top + MONO.chamfer} L${MONO.xR + MONO.side} ${MONO.top + MONO.chamfer} L${MONO.xR + MONO.side} 400 Z" fill="url(#sc-lacia-mono-side)"/>
      <path class="l-mono-body" d="M${MONO.xL} 400 L${MONO.xL} ${MONO.top + MONO.chamfer} L${MONO.xL + MONO.chamfer} ${MONO.top} L${MONO.xR - MONO.chamfer} ${MONO.top} L${MONO.xR} ${MONO.top + MONO.chamfer} L${MONO.xR} 400 Z" fill="url(#sc-lacia-mono-face)"/>
      <path class="l-mono-joint" d="M${MONO.xL + 4} ${MONO.top + 96} L${MONO.xR - 4} ${MONO.top + 96} M${MONO.xL + 8} ${MONO.top + 206} L${MONO.xR - 8} ${MONO.top + 206}"/>
      <path class="l-mono-seam" d="M${(MONO.xL + MONO.xR) / 2} ${MONO.top + 8} L${(MONO.xL + MONO.xR) / 2} 400"/>
      <path class="l-mono-glow" d="M${(MONO.xL + MONO.xR) / 2} ${MONO.top + 8} L${(MONO.xL + MONO.xR) / 2} 400"/>
      <circle class="l-mono-core" cx="${(MONO.xL + MONO.xR) / 2}" cy="${MONO.top + 58}" r="2.6"/>
      <circle class="l-mono-core-halo" cx="${(MONO.xL + MONO.xR) / 2}" cy="${MONO.top + 58}" r="10" filter="url(#sc-lacia-soft)"/>
      <path class="l-mono-cornice" d="M${MONO.xL} ${MONO.top + MONO.chamfer} L${MONO.xL + MONO.chamfer} ${MONO.top} L${MONO.xR - MONO.chamfer} ${MONO.top} L${MONO.xR} ${MONO.top + MONO.chamfer} L${MONO.xR + MONO.side} ${MONO.top + MONO.chamfer}"/>
      <path class="l-mono-edge" d="M${MONO.xR} 400 L${MONO.xR} ${MONO.top + MONO.chamfer} L${MONO.xR + MONO.side} ${MONO.top + MONO.chamfer} M${MONO.xL} ${MONO.top + MONO.chamfer} L${MONO.xL + MONO.chamfer} ${MONO.top}"/>
    </g>`;

  /* ---- aircraft: three dashes and a trail. At this size that is all it takes
   * to put something at a known distance in the sky. ---- */
  const craft = (x: number, y: number, s: number) =>
    `<g class="l-craft" transform="translate(${x} ${y}) scale(${s})">
       <rect x="-30" y="1.1" width="28" height="0.9" class="l-trail"/>
       <path d="M0 0 L15 2.1 L15 3.1 L0 2.1 Z"/>
       <path d="M5.4 1.9 L8.6 -2.6 L9.8 -2.6 L7.4 1.9 Z"/>
     </g>`;
  const craft_ = craft(430, 118, 1.5) + craft(1180, 78, 1.05) + craft(268, 176, 0.8);

  /* ---- the parapet: the camera is on a roof ----
   *
   * Kept from the previous version because it is right: it is the one hard
   * foreground edge, and it is what tells the eye the city is *below*. */
  const lamp = (x: number, top: number, h: number) =>
    `<rect class="fg-post" x="${x}" y="${top}" width="3.4" height="${h}"/>
     <rect class="fg-arm" x="${x - 1}" y="${top}" width="15" height="2.6"/>
     <circle class="fg-lamp-glow" cx="${x + 13}" cy="${top + 1}" r="11"/>
     <circle class="fg-lamp" cx="${x + 13}" cy="${top + 1}" r="2.6"/>`;
  let fg = `<path class="fg-deck" d="M0 374 H1440 V400 H0Z"/>`;
  fg += `<rect class="fg-cap" x="0" y="371.5" width="1440" height="2.5"/>`;
  fg += `<rect class="fg-rail" x="0" y="352" width="1440" height="2"/>`;
  for (let x = 6; x < 1440; x += 26) fg += `<rect class="fg-post" x="${x}" y="352" width="2.2" height="22"/>`;
  fg += lamp(176, 292, 80) + lamp(1252, 300, 72);

  // Floating hexagonal frames — the "analog hack" made visible. Kept out of the
  // device's half of the frame: they are a texture, and a texture on top of the
  // subject is just noise.
  const hex = (i: number, x: number, y: number, s: number) =>
    `<g class="l-hex l-hex-${i}" transform="translate(${x} ${y}) scale(${(s / 22).toFixed(2)})"><path d="M0 -22 L19 -11 L19 11 L0 22 L-19 11 L-19 -11Z"/></g>`;
  const rings = hex(1, 244, 150, 26) + hex(2, 402, 202, 15) + hex(3, 196, 222, 9);

  /* Curtain-wall patterns live in one <defs> block. Two axes, one pitch: the
     horizontal is the material, the vertical is only there so the face is not
     a barcode. Both are deliberately faint — at 45% veil they have to survive
     as texture and disappear as pattern. */
  /* ---- clouds ----
   *
   * The old plate had a *blank* sky over two thirds of the frame, which is why
   * it read as empty paper rather than as weather. On a coastal city the sky
   * is the subject as much as the buildings are: a few flat, very low-contrast
   * bands at different heights do more for "this is a place" than any amount
   * of extra window detail, and because they are horizontal and soft they cost
   * nothing in readability.
   *
   * Drawn as blurred ellipses rather than paths on purpose: a hard cloud edge
   * at this scale turns into a paper cut-out. */
  const cloud = (x: number, y: number, w: number, h: number, o: number) =>
    `<ellipse class="cl" cx="${x}" cy="${y}" rx="${w}" ry="${h}" opacity="${o}"/>`;
  const clouds =
    cloud(240, 196, 300, 26, 0.55) +
    cloud(430, 176, 220, 20, 0.4) +
    cloud(900, 232, 360, 24, 0.5) +
    cloud(1180, 186, 250, 18, 0.35) +
    cloud(620, 262, 480, 30, 0.45) +
    cloud(120, 250, 260, 22, 0.3);

  const cwDefs = `
    <defs>
      <pattern id="sc-lacia-cw" width="7" height="9.5" patternUnits="userSpaceOnUse">
        <rect x="0" y="7.4" width="7" height="1.15" class="cw-h"/>
      </pattern>
      <pattern id="sc-lacia-cwv" width="13" height="9.5" patternUnits="userSpaceOnUse">
        <rect x="11.4" y="0" width="0.9" height="9.5" class="cw-v"/>
      </pattern>
    </defs>`;

  return [
    '<div class="l-bloom"></div>',
    svg('sc-far', `${cwDefs}<filter id="sc-lacia-cloud" x="-30%" y="-120%" width="160%" height="340%"><feGaussianBlur stdDeviation="9"/></filter><g class="l-clouds" filter="url(#sc-lacia-cloud)">${clouds}</g><ellipse class="l-hglow" cx="1008" cy="${HORIZON}" rx="520" ry="78"/><g class="l-shore">${shore}</g>${sea}${craft_}`),
    svg('sc-mid', `<g class="l-mid">${towers}</g><g class="l-cw">${towerBands}</g><g class="l-xway">${xway}</g>`),
    svg('sc-mono', `${mono}`),
    svg('sc-near', `${rings}<g class="l-near">${near}</g>`),
    svg('sc-fg', fg),
    '<div class="l-shaft"></div>',
  ].join('');
}

const BUILDERS: Record<SceneId, () => string> = { ocean, forest, meadow, nightsky, summer, sakura, tenki, lacia };
const cache = new Map<SceneId, string>();

/** Static scene markup (server-rendered once, then cached). */
export function sceneHtml(id: SceneId): string {
  if (!cache.has(id)) cache.set(id, `<div class="scene" data-scene-id="${id}">${BUILDERS[id]()}</div>`);
  return cache.get(id)!;
}
