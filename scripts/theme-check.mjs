#!/usr/bin/env node
/**
 * Validate a theme file before importing it:  npm run theme:check my.theme.json
 * Uses the same schema and CSS checker as the site.
 */
import fs from 'node:fs';
import { registerHooks } from 'node:module';

// The site's TS modules import siblings without an extension (bundler style); resolve them to .ts here.
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !/\.\w+$/.test(spec) && ctx.parentURL?.endsWith('.ts')) return next(`${spec}.ts`, ctx);
    return next(spec, ctx);
  },
});
const { themeSchema, checkThemeCss } = await import('../src/lib/custom-theme.ts');
const { contrast, getPreset } = await import('../src/lib/themes.ts');

const file = process.argv[2];
if (!file) {
  console.log('用法：npm run theme:check <主题文件.theme.json>');
  process.exit(1);
}
let raw;
try {
  raw = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`✗ 无法读取 JSON：${e.message}`);
  process.exit(1);
}
const r = themeSchema.safeParse(raw);
if (!r.success) {
  console.error('✗ 格式不正确：');
  for (const i of r.error.issues) console.error(`  - ${i.path.join('.') || '(根)'}：${i.message}`);
  process.exit(1);
}
const t = r.data;
const warn = [];
const err = [];
const base = getPreset(t.base);
for (const m of ['light', 'dark']) {
  const p = { ...base[m], ...(t.palette[m] ?? {}) };
  const name = m === 'light' ? '日间' : '夜间';
  if (contrast(p.ink, p.bg) < 4.5) err.push(`${name}正文对比度 ${contrast(p.ink, p.bg).toFixed(1)} < 4.5`);
  else if (contrast(p.ink, p.bg) < 7) warn.push(`${name}正文对比度 ${contrast(p.ink, p.bg).toFixed(1)}（建议 ≥ 7）`);
  if (contrast(p.muted, p.bg) < 4.5) warn.push(`${name}次要文字对比度 ${contrast(p.muted, p.bg).toFixed(1)} < 4.5`);
  if (contrast(p.accent, p.bg) < 3) warn.push(`${name}强调色对比度 ${contrast(p.accent, p.bg).toFixed(1)} < 3`);
}
if (t.css.trim()) {
  const c = checkThemeCss(t.css);
  err.push(...c.errors.map((e) => `CSS：${e}`));
  warn.push(...c.warnings.map((w) => `CSS：${w}`));
}
const assets = new Set();
const collect = (v) => typeof v === 'string' && (v.startsWith('/uploads/') || v.startsWith('http')) && assets.add(v);
JSON.stringify(t, (_k, v) => (collect(v), v));
if (t.background.use === 'layers' && t.background.layers.some((l) => l.kind === 'image' && !l.srcDark && l.mode === 'both')) warn.push('有图片图层没有夜间版本（srcDark）');

for (const w of warn) console.log(`  ! ${w}`);
for (const e of err) console.log(`  ✗ ${e}`);
console.log(err.length ? `✗ 「${t.name}」有 ${err.length} 个问题，导入会被拒绝或显示异常` : `✓ 「${t.name}」可以导入（基于 ${base.name}）`);
if (assets.size) console.log(`  引用的素材（导入前需先上传并替换为实际 /uploads/ 路径）：\n    ${[...assets].join('\n    ')}`);
process.exit(err.length ? 1 : 0);
