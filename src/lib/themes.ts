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
export type BgType = 'none' | 'solid' | 'gradient' | 'paper' | 'dots' | 'grid' | 'animated' | 'image';
export type EggSet = 'ink' | 'nature' | 'ocean' | 'anime' | 'starry' | 'paper' | 'minimal' | 'eyecare';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  light: Palette;
  dark: Palette;
  font: 'serif-sans' | 'sans' | 'serif';
  radius: 'sharp' | 'soft' | 'round';
  background: { type: BgType; effect?: BgEffect };
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
    id: 'ocean', name: '海洋', description: '蓝青色调，气泡轻轻上浮。',
    light: { bg: '#f2f7f9', surface: '#ffffff', ink: '#1f2d36', muted: '#536874', faint: '#617582', line: '#dbe6ec', pane: '#e9f1f5', accent: '#1f6e8c', tint: '#e0eef4' },
    dark: { bg: '#0f1a21', surface: '#15232c', ink: '#dde9ef', muted: '#9fb4c0', faint: '#869ca9', line: '#24363f', pane: '#1b2c36', accent: '#7cc4dd', tint: '#1d3442' },
    font: 'sans', radius: 'round', background: { type: 'animated', effect: 'bubbles' },
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
    id: 'starry', name: '星夜', description: '深蓝夜空，星点闪烁。',
    light: { bg: '#f4f5fa', surface: '#ffffff', ink: '#232640', muted: '#585d7a', faint: '#676c88', line: '#e1e3ef', pane: '#eceef6', accent: '#4450a8', tint: '#e5e7f6' },
    dark: { bg: '#0d1020', surface: '#151a2e', ink: '#e3e6f5', muted: '#a5abc8', faint: '#8c92b0', line: '#262c46', pane: '#1b2038', accent: '#a9b4ff', tint: '#232a4d' },
    font: 'serif-sans', radius: 'soft', background: { type: 'animated', effect: 'stars' },
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
];

export const PRESET_IDS = PRESETS.map((p) => p.id) as [string, ...string[]];

export const EGG_SETS: { id: EggSet; name: string }[] = [
  { id: 'ink', name: '墨滴' }, { id: 'nature', name: '落叶' }, { id: 'ocean', name: '气泡' }, { id: 'anime', name: '樱花与星' },
  { id: 'starry', name: '流星' }, { id: 'paper', name: '纸片' }, { id: 'minimal', name: '几何' }, { id: 'eyecare', name: '萤火' },
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
