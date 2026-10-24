#!/usr/bin/env node
/**
 * WCAG contrast audit for a theme palette.
 *
 *   node contrast-check.mjs palette.json
 *
 * palette.json:
 *   { "light": { "bg": "#fbf7f9", "surface": "#ffffff", "ink": "#2a2433", ... },
 *     "dark":  { ... } }
 *
 * The keys are the nine semantic colours a theme normally needs:
 *   bg surface ink muted faint line pane accent tint
 *
 * Every pair below is a real pairing that appears on the page, so a failure here
 * is a failure users will actually hit — not a theoretical one.
 *
 * Exit code 1 when any REQUIRED pair fails, so it can gate a build.
 */
import fs from 'node:fs';

const REQUIRED = 1; // pairs marked required fail the build
const file = process.argv[2];
if (!file) {
  console.error('用法：node contrast-check.mjs <palette.json>');
  process.exit(1);
}
const palette = JSON.parse(fs.readFileSync(file, 'utf8'));

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** WCAG relative luminance. */
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Mix `c` toward white by `t` (0..1) — the usual fix for a too-dark accent. */
const lighten = (rgb, t) => rgb.map((v) => Math.round(v + (255 - v) * t));
const darken = (rgb, t) => rgb.map((v) => Math.round(v * (1 - t)));
const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/** fg/bg pairs that actually occur in the UI, with their minimum ratio. */
const PAIRS = [
  { fg: 'ink', bg: 'bg', min: 7, why: '正文', required: true },
  { fg: 'ink', bg: 'surface', min: 7, why: '卡片正文', required: true },
  { fg: 'muted', bg: 'bg', min: 4.5, why: '次级文字', required: true },
  { fg: 'muted', bg: 'surface', min: 4.5, why: '卡片次级文字', required: true },
  { fg: 'faint', bg: 'surface', min: 4.5, why: '辅助文字（最易翻车）', required: true },
  { fg: 'faint', bg: 'bg', min: 4.5, why: '辅助文字', required: false },
  { fg: 'accent', bg: 'bg', min: 3, why: '链接 / 强调', required: true },
  { fg: 'accent', bg: 'surface', min: 3, why: '卡片内强调', required: true },
  // Button label on a filled accent surface. Uses the dedicated onAccent colour
  // when the theme has one (most do — it is usually pure white or near-black),
  // otherwise falls back to bg, which is the pessimistic case.
  { fg: ['onAccent', 'bg'], bg: 'accent', min: 4.5, why: '强调色底上的按钮文字', required: true },
  { fg: 'line', bg: 'bg', min: 1.25, why: '分割线可见度', required: false },
];

let failures = 0;

for (const [mode, p] of Object.entries(palette)) {
  if (!p || typeof p !== 'object') continue;
  console.log(`\n=== ${mode} ===`);
  for (const pair of PAIRS) {
    const fgKeys = Array.isArray(pair.fg) ? pair.fg : [pair.fg];
    const fgKey = fgKeys.find((k) => hex(p[k])) ?? fgKeys[0];
    const fg = hex(p[fgKey]);
    const bg = hex(p[pair.bg]);
    const label = `${fgKey}/${pair.bg}`;
    if (!fg || !bg) {
      console.log(`  ?  ${label}  — 缺少色值，跳过`);
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= pair.min;
    if (!ok && pair.required) failures++;
    const mark = ok ? '✓' : pair.required ? '✗' : '!';
    console.log(
      `  ${mark}  ${label.padEnd(20)} ${r.toFixed(2).padStart(5)}  (需 ≥ ${pair.min})  ${pair.why}`,
    );
    if (!ok) {
      // Suggest a concrete fix rather than just complaining: nudge toward the
      // background's opposite (darker text on a light bg, lighter on a dark bg).
      const bgIsLight = lum(bg) > 0.35;
      const step = bgIsLight ? darken : lighten;
      let fixed = fg;
      for (let t = 0.05; t <= 0.95; t += 0.05) {
        fixed = step(fg, t);
        if (ratio(fixed, bg) >= pair.min) break;
      }
      console.log(`       → 可改为 ${toHex(fixed)}（对比度 ${ratio(fixed, bg).toFixed(2)}）`);
    }
  }
}

console.log('');
if (failures) {
  console.log(`✗ ${failures} 项必需对比度未达标`);
  process.exit(1);
}
console.log('✓ 全部必需对比度达标');
