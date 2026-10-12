/**
 * Theme registry — pure data shared by server (SSR attributes / CSS vars)
 * and client (owner live preview, background effects, egg sets).
 */

export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  pane: string;
  accent: string;
  tint: string;
}

export type BgEffect = 'particles' | 'sakura' | 'leaves' | 'bubbles' | 'stars' | 'waves' | 'fireflies' | 'snow';
export type BgType = 'none' | 'solid' | 'gradient' | 'paper' | 'dots' | 'grid' | 'animated' | 'image' | 'scene';
export type EggSet = 'ink' | 'nature' | 'ocean' | 'anime' | 'starry' | 'paper' | 'minimal' | 'eyecare' | 'summer' | 'sakura' | 'tenki';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  light: Palette;
  dark: Palette;
  font: 'serif-sans' | 'sans' | 'serif';
  radius: 'sharp' | 'soft' | 'round';
  /** effect is a canvas effect id (bg-effects or scene-effects); scene is a scenes.ts id. */
  background: { type: BgType; effect?: string; scene?: string };
  /** Optional mascot character shown in a page corner (anime-style themes); ids from mascot.ts. */
  mascot?: 'chibi' | 'haru' | 'sora';
  /** SVG body (24×24) for the theme cursor. */
  cursorGlyph: string;
  eggSet: EggSet;
  /** Particle colors for effects and eggs. */
  fx: string[];
}

export const PRESETS: ThemePreset[] = [
  {
    id: 'ink', name: '墨韵', description: '默认。纸墨质感、克制留白，适合长文阅读。',
    light: { bg: '#f8f8f5', surface: '#ffffff', ink: '#262c2b', muted: '#5f6866', faint: '#6f7773', line: '#e4e7e2', pane: '#f0f3ef', accent: '#315b50', tint: '#e8efeb' },
    dark: { bg: '#171c1b', surface: '#1f2725', ink: '#e4ece7', muted: '#a9b6af', faint: '#8e9d95', line: '#33403a', pane: '#26312c', accent: '#9fcbb5', tint: '#2a3d34' },
    font: 'serif-sans', radius: 'soft', background: { type: 'none' },
    cursorGlyph: '<circle cx="12" cy="12" r="4" fill="#315b50"/><circle cx="12" cy="12" r="8" fill="none" stroke="#315b50" stroke-opacity=".35"/>',
    eggSet: 'ink', fx: ['#315b50', '#7a9b8f', '#262c2b'],
  },
  {
    id: 'nature', name: '自然', description: '苔绿与木色，落叶缓缓飘过。',
    light: { bg: '#f5f3ec', surface: '#fffdf7', ink: '#2c3226', muted: '#5d6455', faint: '#6c7262', line: '#e3e0d2', pane: '#eeebe0', accent: '#4f6b2f', tint: '#e8eddc' },
    dark: { bg: '#181b14', surface: '#20241b', ink: '#e6e9dc', muted: '#adb39f', faint: '#939985', line: '#343a2b', pane: '#272c20', accent: '#a9c77c', tint: '#2e3a22' },
    font: 'serif-sans', radius: 'round', background: { type: 'animated', effect: 'leaves' },
    cursorGlyph: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15z" fill="#6b8a3a"/><path d="M5 19 14 10" stroke="#3d5320" stroke-width="1.4"/>',
    eggSet: 'nature', fx: ['#6b8a3a', '#b5893c', '#8fae5a', '#c2703d'],
  },
  {
    id: 'ocean', name: '海洋', description: '蔚蓝海面、远岛与帆影，浪花起伏，阳光（或月光）在水面闪烁。',
    light: { bg: '#f2f7f9', surface: '#ffffff', ink: '#1f2d36', muted: '#536874', faint: '#617582', line: '#dbe6ec', pane: '#e9f1f5', accent: '#1f6e8c', tint: '#e0eef4' },
    dark: { bg: '#0f1a21', surface: '#15232c', ink: '#dde9ef', muted: '#9fb4c0', faint: '#869ca9', line: '#24363f', pane: '#1b2c36', accent: '#7cc4dd', tint: '#1d3442' },
    font: 'sans', radius: 'round', background: { type: 'scene', scene: 'ocean', effect: 'glints' },
    cursorGlyph: '<circle cx="12" cy="12" r="7" fill="#7cc4dd" fill-opacity=".35" stroke="#1f6e8c" stroke-width="1.4"/><circle cx="9.5" cy="9.5" r="1.6" fill="#fff"/>',
    eggSet: 'ocean', fx: ['#1f6e8c', '#7cc4dd', '#a8dcec', '#3d9bb8'],
  },
  {
    id: 'anime', name: '二次元', description: '樱粉与薰衣草，樱花飘落，星形光标。',
    light: { bg: '#fdf6f8', surface: '#ffffff', ink: '#33283a', muted: '#6d5e72', faint: '#7a6c7f', line: '#f0e1e8', pane: '#f9eef3', accent: '#b23c6f', tint: '#fbe6ef' },
    dark: { bg: '#1b1520', surface: '#241c2a', ink: '#f1e6f0', muted: '#c2b0c4', faint: '#a796aa', line: '#3a2e40', pane: '#2b2231', accent: '#f29ac0', tint: '#3d2638' },
    font: 'sans', radius: 'round', background: { type: 'animated', effect: 'sakura' },
    cursorGlyph: '<path d="m12 2 2.6 6.6L21 9.5l-5 4.5 1.5 7L12 17.3 6.5 21 8 14 3 9.5l6.4-.9z" fill="#f29ac0" stroke="#b23c6f" stroke-width="1"/>',
    eggSet: 'anime', fx: ['#f29ac0', '#ffc6dc', '#b8a4f0', '#ffe28a'],
  },
  {
    id: 'starry', name: '星夜', description: '银河横贯夜空，群山剪影下一顶亮着灯的帐篷，偶有流星划过。',
    light: { bg: '#f4f5fa', surface: '#ffffff', ink: '#232640', muted: '#585d7a', faint: '#676c88', line: '#e1e3ef', pane: '#eceef6', accent: '#4450a8', tint: '#e5e7f6' },
    dark: { bg: '#0d1020', surface: '#151a2e', ink: '#e3e6f5', muted: '#a5abc8', faint: '#8c92b0', line: '#262c46', pane: '#1b2038', accent: '#a9b4ff', tint: '#232a4d' },
    font: 'serif-sans', radius: 'soft', background: { type: 'scene', scene: 'nightsky', effect: 'nightsky' },
    cursorGlyph: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" fill="#ffe9a8" stroke="#4450a8" stroke-width="1"/>',
    eggSet: 'starry', fx: ['#ffe9a8', '#a9b4ff', '#ffffff', '#ffd2f0'],
  },
  {
    id: 'paper', name: '纸张', description: '米黄纸纹，像在读一本旧书。',
    light: { bg: '#f6f0e3', surface: '#fbf7ed', ink: '#2f2a22', muted: '#5c5446', faint: '#6c6455', line: '#e5dcc8', pane: '#efe7d5', accent: '#8a4b2a', tint: '#f0e2d2' },
    dark: { bg: '#1c1a16', surface: '#24211c', ink: '#ebe3d3', muted: '#b6ab97', faint: '#9e937f', line: '#3a352c', pane: '#2b2721', accent: '#e0a77f', tint: '#3e3026' },
    font: 'serif', radius: 'sharp', background: { type: 'paper' },
    cursorGlyph: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" fill="#f6f0e3" stroke="#8a4b2a" stroke-width="1.5"/>',
    eggSet: 'paper', fx: ['#8a4b2a', '#c69a6d', '#d8c8a8', '#2f2a22'],
  },
  {
    id: 'minimal', name: '极简', description: '灰阶与几何，没有多余的东西。',
    light: { bg: '#fafafa', surface: '#ffffff', ink: '#1c1c1c', muted: '#585858', faint: '#6b6b6b', line: '#e6e6e6', pane: '#f2f2f2', accent: '#1c1c1c', tint: '#ececec' },
    dark: { bg: '#121212', surface: '#1a1a1a', ink: '#ececec', muted: '#a8a8a8', faint: '#919191', line: '#2e2e2e', pane: '#202020', accent: '#ececec', tint: '#2a2a2a' },
    font: 'sans', radius: 'sharp', background: { type: 'grid' },
    cursorGlyph: '<rect x="8" y="8" width="8" height="8" fill="#1c1c1c"/>',
    eggSet: 'minimal', fx: ['#1c1c1c', '#767676', '#bdbdbd'],
  },
  {
    id: 'eyecare', name: '护眼', description: '低对比暖绿底，长时间阅读不易疲劳。',
    light: { bg: '#e9f1e2', surface: '#f2f7ec', ink: '#2a3324', muted: '#4f5b47', faint: '#5f6a57', line: '#d5e0cb', pane: '#e1ebd8', accent: '#3f6a2f', tint: '#dbe8d0' },
    dark: { bg: '#1a1f17', surface: '#21271d', ink: '#d9e2cf', muted: '#a3ae98', faint: '#8d9882', line: '#333b2d', pane: '#273022', accent: '#a3c98c', tint: '#2d3a26' },
    font: 'serif-sans', radius: 'soft', background: { type: 'animated', effect: 'fireflies' },
    cursorGlyph: '<circle cx="12" cy="12" r="4.5" fill="#c8e06a"/><circle cx="12" cy="12" r="8" fill="#c8e06a" fill-opacity=".25"/>',
    eggSet: 'eyecare', fx: ['#c8e06a', '#a3c98c', '#fff1a0'],
  },
  {
    id: 'forest', name: '森林', description: '层叠松林与晨雾，林间光束里飘着微尘；入夜后萤火点点。',
    light: { bg: '#eef2e8', surface: '#f8faf4', ink: '#22301f', muted: '#4d5d48', faint: '#5d6c57', line: '#d8e0cf', pane: '#e6ecdd', accent: '#2f6b45', tint: '#dfeadb' },
    dark: { bg: '#0f1a15', surface: '#16231c', ink: '#dfe9e0', muted: '#a3b5a6', faint: '#8a9e8d', line: '#26372d', pane: '#1b2a22', accent: '#8fd1a3', tint: '#1f3528' },
    font: 'serif-sans', radius: 'soft', background: { type: 'scene', scene: 'forest', effect: 'motes' },
    cursorGlyph: '<path d="M12 2 6 11h3l-4 6h5v5h4v-5h5l-4-6h3z" fill="#2f6b45"/>',
    eggSet: 'nature', fx: ['#2f6b45', '#8fd1a3', '#d6f580', '#6b8a3a'],
  },
  {
    id: 'meadow', name: '草原', description: '流云掠过起伏的山丘，草浪随风摇曳，蒲公英种子飘在空中。',
    light: { bg: '#f4f6ea', surface: '#fcfdf6', ink: '#283222', muted: '#56614b', faint: '#646f58', line: '#e0e5d0', pane: '#eceedf', accent: '#4a7a2c', tint: '#e5eed8' },
    dark: { bg: '#121a2c', surface: '#192236', ink: '#e1e6f0', muted: '#a7b1c4', faint: '#8d97ab', line: '#29334a', pane: '#1e2840', accent: '#a9d38a', tint: '#26344a' },
    font: 'serif-sans', radius: 'round', background: { type: 'scene', scene: 'meadow', effect: 'seeds' },
    cursorGlyph: '<g stroke="#4a7a2c" stroke-width="1.2" fill="none"><path d="M12 12 12 22"/><path d="M12 12l0-7M12 12l5-5M12 12l7 0M12 12l5 5M12 12l-5 5M12 12l-7 0M12 12l-5-5"/></g><circle cx="12" cy="12" r="2" fill="#4a7a2c"/>',
    eggSet: 'nature', fx: ['#4a7a2c', '#a9d38a', '#fff3b0', '#ffffff'],
  },
  {
    id: 'summer', name: '夏日物语', description: '二次元升级版：积雨云、海边小镇与驶过的电车，看板娘在角落陪你读书；夜晚远处有烟花。',
    light: { bg: '#f3f9fd', surface: '#ffffff', ink: '#1f2b3a', muted: '#4f5f74', faint: '#5d6d82', line: '#dbe8f2', pane: '#eaf3fa', accent: '#1f78c8', tint: '#e2effa' },
    dark: { bg: '#121836', surface: '#1a2146', ink: '#e8eaf8', muted: '#b0b6d4', faint: '#979eba', line: '#2c3462', pane: '#1f2750', accent: '#ffb3cf', tint: '#3a2a52' },
    font: 'sans', radius: 'round', background: { type: 'scene', scene: 'summer', effect: 'summer' },
    cursorGlyph: '<path d="m12 3 2.4 5.6 6 .6-4.6 4 1.4 6L12 16l-5.2 3.2 1.4-6-4.6-4 6-.6z" fill="#ffd36e" stroke="#1f78c8" stroke-width="1.1"/>',
    eggSet: 'summer', fx: ['#ffb3cf', '#9ed8ff', '#ffe28a', '#ffffff'],
    mascot: 'chibi',
  },
  {
    id: 'sakura', name: '樱花坂', description: '日系动画升级版：通透的蓝天与高耸的积雨云，坡下校舍、踏切与电线，樱花纷飞；看板娘「小春」在角落陪你。夜里是夜樱与道口红灯。',
    light: { bg: '#fbf7f9', surface: '#ffffff', ink: '#2a2433', muted: '#5b5266', faint: '#6a6175', line: '#efe3ea', pane: '#f6edf2', accent: '#c2457a', tint: '#fbe7f0' },
    dark: { bg: '#171a2e', surface: '#1e2238', ink: '#eef0fa', muted: '#b4b8d0', faint: '#9a9fba', line: '#2e3350', pane: '#232842', accent: '#ffa8c8', tint: '#3a2a48' },
    font: 'sans', radius: 'round', background: { type: 'scene', scene: 'sakura', effect: 'petals' },
    cursorGlyph: '<g transform="translate(12 12)">' + [0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a})" d="M0 0C-4 -3.6 -3.3 -9.4 -.9 -10.5L0 -9.1 .9 -10.5C3.3 -9.4 4 -3.6 0 0Z" fill="#ffc6da" stroke="#c2457a" stroke-width=".8"/>`).join('') + '<circle r="1.7" fill="#ffd877"/></g>',
    eggSet: 'sakura', fx: ['#ffc6da', '#ff9fc0', '#fff0f6', '#ffe08a'],
    mascot: 'haru',
  },
  {
    id: 'tenki', name: '晴空之子', description: '致敬《天气之子》的氛围：雨中的东京天际线，厚重云层裂开一道阳光洒向城市，屋顶上的小鸟居与彩虹；看板娘「小晴」撑着透明伞。夜里霓虹映着雨。',
    light: { bg: '#f2f6fa', surface: '#ffffff', ink: '#1c2433', muted: '#4a5568', faint: '#5a6578', line: '#dde5ee', pane: '#e8eef5', accent: '#2f6fb8', tint: '#e1ecf8' },
    dark: { bg: '#0f1424', surface: '#161c30', ink: '#e8edf7', muted: '#aab4c8', faint: '#8f9ab0', line: '#263049', pane: '#1a2138', accent: '#ffc861', tint: '#2c2a36' },
    font: 'sans', radius: 'round', background: { type: 'scene', scene: 'tenki', effect: 'rain' },
    cursorGlyph: '<path d="M12 3C9 8 6.5 11 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 11 15 8 12 3Z" fill="#9fd4ff" stroke="#2f6fb8" stroke-width="1.1"/><path d="M9.6 14.6a2.6 2.6 0 0 0 2 2.4" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
    eggSet: 'tenki', fx: ['#ffd36e', '#9fd4ff', '#ffffff', '#ffb38a'],
    mascot: 'sora',
  },
];

export const PRESET_IDS = PRESETS.map((p) => p.id) as [string, ...string[]];

export const EGG_SETS: { id: EggSet; name: string }[] = [
  { id: 'ink', name: '墨滴' }, { id: 'nature', name: '落叶' }, { id: 'ocean', name: '气泡' }, { id: 'anime', name: '樱花与星' },
  { id: 'starry', name: '流星' }, { id: 'paper', name: '纸片' }, { id: 'minimal', name: '几何' }, { id: 'eyecare', name: '萤火' },
  { id: 'summer', name: '夏日烟花' }, { id: 'sakura', name: '樱吹雪' }, { id: 'tenki', name: '晴天祈愿' },
];

export const BG_EFFECTS: { id: BgEffect; name: string }[] = [
  { id: 'particles', name: '浮动粒子' }, { id: 'sakura', name: '樱花' }, { id: 'leaves', name: '落叶' }, { id: 'bubbles', name: '气泡' },
  { id: 'stars', name: '星空' }, { id: 'waves', name: '波浪' }, { id: 'fireflies', name: '萤火' }, { id: 'snow', name: '雪' },
];

export function getPreset(id: string): ThemePreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
}

/* ---------------- color helpers ---------------- */

export const HEX = /^#[0-9a-f]{6}$/i;

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

/** Mix two hex colors (t = share of b). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Palette as CSS variables, with an optional validated custom accent. */
export function paletteVars(p: Palette, customAccent: string | null): Record<string, string> {
  const custom = customAccent && HEX.test(customAccent) ? customAccent : null;
  return {
    '--bg': p.bg, '--surface': p.surface, '--ink': p.ink, '--muted': p.muted, '--faint': p.faint,
    '--line': p.line, '--pane': p.pane, '--accent': custom ?? p.accent, '--tint': custom ? mix(p.surface, custom, 0.14) : p.tint,
  };
}

export function cursorDataUri(glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${glyph}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`;
}
