/**
 * Custom themes ("主题包"). A custom theme is data only: it extends one of the
 * built-in presets and overrides palette, type, shape, layered backgrounds,
 * particles, stickers, cursor, eggs and mascot. It can also carry a small
 * custom CSS file, which is checked by `checkThemeCss` before it is accepted.
 *
 * Shared by the server (validation, SSR) and the owner UI (editor, preview).
 * Export format: `fieldnotes-theme@1` JSON (optionally zipped with assets).
 */
import { z } from 'zod';
import { HEX, PRESET_IDS } from './themes';

const hex = z.string().regex(HEX, '颜色必须是 #rrggbb');
/** Site upload or an http(s) URL — the same rule the rest of the site uses. */
const asset = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^\/uploads\/[a-z0-9._-]+$/i.test(v) || /^https?:\/\/[^\s"'()<>\\]+$/i.test(v), '素材地址必须是 /uploads/… 或 http(s) 链接');

export const paletteSchema = z.object({
  bg: hex, surface: hex, ink: hex, muted: hex, faint: hex, line: hex, pane: hex, accent: hex, tint: hex,
});

export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'] as const;

export const layerSchema = z.object({
  /** image: an uploaded picture; gradient: two-colour linear gradient; scene: a built-in vector scene; texture: paper/dots/grid. */
  kind: z.enum(['image', 'gradient', 'scene', 'texture']),
  src: asset.optional(),
  srcDark: asset.optional(),
  from: hex.optional(),
  to: hex.optional(),
  angle: z.number().min(0).max(360).default(180),
  scene: z.string().max(40).optional(),
  texture: z.enum(['paper', 'dots', 'grid']).optional(),
  /** Placement in the viewport. */
  position: z.enum(['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).default('center'),
  size: z.enum(['cover', 'contain', 'auto', 'width']).default('cover'),
  repeat: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
  blend: z.enum(BLEND_MODES).default('normal'),
  /** Parallax depth: 0 = fixed to the viewport, 1 = scrolls with the page. */
  depth: z.number().min(0).max(1).default(0),
  /** Slow horizontal drift (clouds, mist). Disabled with motion off. */
  drift: z.enum(['none', 'slow', 'medium']).default('none'),
  /** Only show in light or dark mode. */
  mode: z.enum(['both', 'light', 'dark']).default('both'),
});
export type ThemeLayer = z.infer<typeof layerSchema>;

export const STICKER_SLOTS = ['hero', 'card-corner', 'divider', 'footer', 'empty', 'sidebar'] as const;
export const STICKER_SLOT_LABELS: Record<(typeof STICKER_SLOTS)[number], string> = {
  hero: '首页标题旁',
  'card-corner': '文章卡片角',
  divider: '分隔线中间',
  footer: '页脚',
  empty: '空状态插画',
  sidebar: '侧栏顶部',
};

export const themeSchema = z.object({
  format: z.literal('fieldnotes-theme@1').default('fieldnotes-theme@1'),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).default(''),
  author: z.string().trim().max(60).default(''),
  version: z.string().trim().max(20).default('1.0.0'),
  /** Built-in preset this theme starts from: everything not set here is inherited. */
  base: z.enum(PRESET_IDS).default('ink'),
  palette: z.object({ light: paletteSchema, dark: paletteSchema }).partial().default({}),
  typography: z
    .object({
      display: z.enum(['serif', 'sans', 'custom']).optional(),
      body: z.enum(['serif', 'sans', 'custom']).optional(),
      /** Uploaded woff2 font URLs (see docs for licensing). */
      displayFont: asset.optional(),
      bodyFont: asset.optional(),
      scale: z.number().min(0.85).max(1.25).default(1),
      lineHeight: z.number().min(1.4).max(2.4).optional(),
      headingWeight: z.number().int().min(400).max(900).optional(),
      letterSpacing: z.number().min(-0.02).max(0.12).default(0),
    })
    .default({ scale: 1, letterSpacing: 0 }),
  shape: z
    .object({
      radius: z.enum(['sharp', 'soft', 'round']).optional(),
      border: z.number().min(0).max(3).default(1),
      shadow: z.enum(['none', 'soft', 'paper', 'lifted']).default('soft'),
      density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
    })
    .default({ border: 1, shadow: 'soft' }),
  background: z
    .object({
      /** inherit: use the base preset's background; layers: use the layers below. */
      use: z.enum(['inherit', 'layers']).default('inherit'),
      layers: z.array(layerSchema).max(6).default([]),
      /** Opacity of the panel behind article text (0.6–1), keeps reading comfortable. */
      readingPanel: z.number().min(0.6).max(1).default(0.9),
      blur: z.number().min(0).max(20).default(6),
    })
    .default({ use: 'inherit', layers: [], readingPanel: 0.9, blur: 6 }),
  particles: z
    .object({
      use: z.enum(['inherit', 'none', 'builtin', 'image']).default('inherit'),
      effect: z.string().max(30).optional(),
      images: z.array(asset).max(4).default([]),
      motion: z.enum(['fall', 'rise', 'drift', 'twinkle']).default('fall'),
      count: z.number().int().min(4).max(80).default(30),
      speed: z.number().min(0.2).max(3).default(1),
      size: z.number().min(6).max(64).default(18),
      darkOnly: z.boolean().default(false),
    })
    .default({ use: 'inherit', images: [], motion: 'fall', count: 30, speed: 1, size: 18, darkOnly: false }),
  stickers: z
    .array(
      z.object({
        slot: z.enum(STICKER_SLOTS),
        src: asset,
        size: z.number().int().min(16).max(320).default(64),
        opacity: z.number().min(0.1).max(1).default(1),
        rotate: z.number().min(-45).max(45).default(0),
      }),
    )
    .max(12)
    .default([]),
  cursor: z.object({ src: asset.optional(), hotspot: z.tuple([z.number().int().min(0).max(31), z.number().int().min(0).max(31)]).default([4, 4]) }).default({ hotspot: [4, 4] }),
  eggSet: z.string().max(30).optional(),
  /** Built-in character id or pack:<id>. */
  mascot: z.string().max(40).optional(),
  /** Optional custom CSS (checked by checkThemeCss). */
  css: z.string().max(20_000).default(''),
});
export type CustomTheme = z.infer<typeof themeSchema>;

export interface StoredTheme extends CustomTheme {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- custom CSS safety check ---------------- */

export interface CssCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** The CSS as accepted (every rule scoped under the custom theme). */
  css: string;
}

/** Selectors a theme must not restyle: the workspace, the owner preview ball and the site dial's keyboard affordances. */
const PROTECTED = [/\.owner\b/, /\[data-owner/, /\.preview-ball/, /#main\b/, /\.skip-link/];
const FORBIDDEN = [
  { re: /@import\b/i, msg: '不允许 @import（会加载外部样式）' },
  { re: /expression\s*\(/i, msg: '不允许 expression()' },
  { re: /javascript\s*:/i, msg: '不允许 javascript: 链接' },
  { re: /behavior\s*:/i, msg: '不允许 behavior 属性' },
  { re: /-moz-binding/i, msg: '不允许 -moz-binding' },
  { re: /<\/?\s*(style|script)/i, msg: '不允许出现 <style> / <script> 标签' },
  { re: /@font-face[\s\S]*?src\s*:[^;}]*url\(\s*['"]?(?!\/uploads\/)/i, msg: '@font-face 只能引用 /uploads/ 下的字体' },
];

/**
 * Validate custom theme CSS so a bad file cannot break the page:
 * - balanced braces / comments / quotes, size limit;
 * - no @import, expression(), javascript:, external url() (only /uploads/ and data:image);
 * - no rules that hide or cover the whole page (display:none / visibility:hidden on html/body/main, huge fixed overlays);
 * - every selector is prefixed with `html[data-custom-theme]` so it only applies while the theme is active.
 */
export function checkThemeCss(input: string): CssCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const src = input.replace(/\r\n?/g, '\n');
  if (src.length > 20_000) errors.push('CSS 不能超过 20000 个字符');
  for (const f of FORBIDDEN) if (f.re.test(src)) errors.push(f.msg);

  // Strip comments, then check structure.
  if ((src.match(/\/\*/g) ?? []).length !== (src.match(/\*\//g) ?? []).length) errors.push('注释 /* */ 没有成对闭合');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let quote = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < 0) break;
    }
  }
  if (quote) errors.push('有未闭合的引号');
  if (depth !== 0) errors.push('花括号 { } 没有成对');

  for (const m of body.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    const u = m[2]!.trim();
    if (!/^\/uploads\/[a-z0-9._-]+$/i.test(u) && !/^data:image\/(png|webp|gif|svg\+xml);/i.test(u)) errors.push(`url(${u.slice(0, 60)}) 不允许：只能引用 /uploads/ 下的文件`);
  }
  if (errors.length) return { ok: false, errors, warnings, css: '' };

  // Scope each rule. Handles plain rules and one level of @media/@supports; keeps @keyframes and @font-face as is.
  const out: string[] = [];
  const scope = (sel: string) =>
    sel
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        if (PROTECTED.some((p) => p.test(s))) {
          warnings.push(`选择器 “${s}” 涉及工作台或站点控件，已忽略`);
          return '';
        }
        if (/^(:root|html)\b/.test(s)) return s.replace(/^(:root|html)/, 'html[data-custom-theme]');
        return `html[data-custom-theme] ${s}`;
      })
      .filter(Boolean)
      .join(', ');

  const danger = (selector: string, decls: string) => {
    const whole = /(^|,)\s*(html|body|:root|main|\.main|\*)\s*($|,)/.test(selector);
    if (whole && /(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0+)?\s*(;|$))/i.test(decls)) return '不能隐藏整个页面（html / body / main 上的 display:none、visibility:hidden、opacity:0）';
    if (/position\s*:\s*fixed/i.test(decls) && /(inset\s*:\s*0|width\s*:\s*100v[wh]|height\s*:\s*100v[wh])/i.test(decls) && !/pointer-events\s*:\s*none/i.test(decls))
      return `“${selector}” 是覆盖全屏的固定层，必须加 pointer-events: none，否则页面会无法点击`;
    if (/z-index\s*:\s*(\d{4,})/i.test(decls)) return `“${selector}” 的 z-index 过大（≤ 999）`;
    return null;
  };

  const walk = (text: string, inBlock: string | null) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) break;
      const head = text.slice(i, open).trim();
      // find the matching close
      let d = 1;
      let j = open + 1;
      for (; j < text.length && d; j++) {
        if (text[j] === '{') d++;
        else if (text[j] === '}') d--;
      }
      const inner = text.slice(open + 1, j - 1);
      if (/^@(media|supports)\b/i.test(head)) {
        const before = out.length;
        walk(inner, head);
        const rules = out.splice(before);
        if (rules.length) out.push(`${head} {\n${rules.join('\n')}\n}`);
      } else if (/^@(keyframes|-webkit-keyframes|font-face)\b/i.test(head)) {
        out.push(`${head} {${inner}}`);
      } else if (head.startsWith('@')) {
        warnings.push(`已忽略不支持的规则 ${head.split(/\s/)[0]}`);
      } else if (head) {
        const problem = danger(head, inner);
        if (problem) errors.push(problem);
        const sel = scope(head);
        if (sel) out.push(`${sel} {${inner}}`);
      }
      i = j;
    }
    void inBlock;
  };
  walk(body, null);
  return { ok: errors.length === 0, errors, warnings, css: errors.length ? '' : out.join('\n') };
}

/* ---------------- theme rotation & triggers ---------------- */

export const rotationSchema = z.object({
  /** fixed: always the chosen theme; random: pick one per visit day; schedule: by time / date rules. */
  mode: z.enum(['fixed', 'random', 'rotate', 'schedule']).default('fixed'),
  /** Theme ids (built-in preset ids or custom:<id>) taking part in random/rotate. */
  pool: z.array(z.string().max(60)).max(30).default([]),
  /** rotate: switch every N days. */
  everyDays: z.number().int().min(1).max(60).default(7),
  rules: z
    .array(
      z.object({
        theme: z.string().max(60),
        /** Time window "HH:MM-HH:MM" (can wrap past midnight). */
        time: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/).optional(),
        /** Date range "MM-DD..MM-DD" (can wrap past new year). */
        dates: z.string().regex(/^\d{2}-\d{2}\.\.\d{2}-\d{2}$/).optional(),
        /** Days of week 0 (Sun) – 6. */
        weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
        label: z.string().max(40).default(''),
      }),
    )
    .max(20)
    .default([]),
  /** Easter-egg theme switches (client side, for the current visit only). */
  eggs: z
    .array(
      z.object({
        trigger: z.enum(['konami', 'logo-7', 'typed-word', 'idle-night', 'read-3']),
        word: z.string().trim().max(20).optional(),
        theme: z.string().max(60),
        /** How long the switch lasts in minutes (0 = until the tab is closed). */
        minutes: z.number().int().min(0).max(240).default(0),
      }),
    )
    .max(10)
    .default([]),
});
export type ThemeRotation = z.infer<typeof rotationSchema>;

const inWindow = (now: number, from: number, to: number) => (from <= to ? now >= from && now < to : now >= from || now < to);
const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const md = (s: string) => Number(s.slice(0, 2)) * 100 + Number(s.slice(3, 5));

/** Pick the active theme id for a given moment (server side, deterministic for a day). */
export function pickTheme(base: string, r: ThemeRotation, date: Date, valid: (id: string) => boolean): string {
  if (r.mode === 'schedule') {
    const t = date.getHours() * 60 + date.getMinutes();
    const d = (date.getMonth() + 1) * 100 + date.getDate();
    for (const rule of r.rules) {
      if (!valid(rule.theme)) continue;
      if (rule.time) {
        const [a, b] = rule.time.split('-') as [string, string];
        if (!inWindow(t, mins(a), mins(b))) continue;
      }
      if (rule.dates) {
        const [a, b] = rule.dates.split('..') as [string, string];
        if (!inWindow(d, md(a), md(b) + 1)) continue;
      }
      if (rule.weekdays?.length && !rule.weekdays.includes(date.getDay())) continue;
      return rule.theme;
    }
    return base;
  }
  const pool = r.pool.filter(valid);
  if (!pool.length || r.mode === 'fixed') return base;
  const day = Math.floor(date.getTime() / 86_400_000);
  if (r.mode === 'rotate') return pool[Math.floor(day / r.everyDays) % pool.length]!;
  // random: stable within a day (no flicker between pages), different across days
  let h = day * 2654435761;
  h = (h ^ (h >>> 13)) >>> 0;
  return pool[h % pool.length]!;
}
