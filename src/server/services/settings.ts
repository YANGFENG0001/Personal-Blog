import { z } from 'zod';
import { getDb } from '../db';
import { DEFAULT_SETTINGS, type Settings } from '../seed';
import { httpUrl, imageUrl } from '../validation';
import { EGG_SETS, HEX, PRESET_IDS } from '../../lib/themes';
import { SCENES } from '../../lib/scenes';

const hex = z.string().regex(HEX, '颜色格式应为 #rrggbb');

const schemas = {
  site: z.object({
    title: z.string().trim().min(1).max(60),
    subtitle: z.string().trim().max(120),
    intro: z.string().trim().max(1000),
    launchDate: z.iso.date(),
    footer: z.string().trim().max(300),
    language: z.string().trim().max(20),
  }),
  profile: z.object({
    public: z.boolean(),
    name: z.string().trim().min(1).max(60),
    avatarText: z.string().trim().max(2),
    avatarUrl: z.union([z.literal(''), imageUrl]),
    bio: z.string().trim().max(600),
    interests: z.array(z.string().trim().min(1).max(30)).max(12),
    links: z.array(z.object({ label: z.string().trim().min(1).max(40), url: httpUrl })).max(8),
  }),
  appearance: z.object({
    preset: z.enum(PRESET_IDS),
    theme: z.enum(['system', 'light', 'dark']),
    customAccent: z.union([z.literal(''), hex]),
    motion: z.enum(['off', 'minimal', 'normal', 'rich']),
    density: z.enum(['compact', 'comfortable', 'spacious']),
    font: z.enum(['preset', 'serif-sans', 'sans', 'serif']),
    radius: z.enum(['preset', 'sharp', 'soft', 'round']),
    cursor: z.enum(['system', 'dot', 'ring', 'theme']),
    cursorTrail: z.boolean(),
    background: z.object({
      type: z.enum(['preset', 'none', 'solid', 'gradient', 'paper', 'dots', 'grid', 'animated', 'image', 'scene']),
      scene: z.enum(SCENES.map((x) => x.id) as [string, ...string[]]),
      effect: z.enum(['particles', 'sakura', 'leaves', 'bubbles', 'stars', 'waves', 'fireflies', 'snow']),
      color: hex,
      gradientFrom: hex,
      gradientTo: hex,
      imageUrl: z.union([z.literal(''), imageUrl]),
      overlay: z.number().min(0).max(1),
      blur: z.number().min(0).max(20),
      fixed: z.boolean(),
      intensity: z.enum(['low', 'medium', 'high']),
    }),
    iconMotion: z.boolean(),
    cardMotion: z.boolean(),
    mascot: z.object({
      mode: z.enum(['preset', 'on', 'off']),
      character: z.enum(['preset', 'haru', 'sora', 'chibi']),
      draggable: z.boolean(),
      imageUrl: z.union([z.literal(''), imageUrl]),
      position: z.enum(['right', 'left']),
      size: z.enum(['sm', 'md', 'lg']),
    }),
  }),
  dial: z
    .object({
      layout: z.enum(['orbit', 'arc', 'list', 'rail']),
      shape: z.enum(['card', 'capsule', 'half', 'leaf', 'glass']),
      handle: z.enum(['tab', 'dot', 'line']),
      showTitle: z.boolean(),
      showEnglish: z.boolean(),
      showHint: z.boolean(),
      showOrbit: z.boolean(),
      showList: z.boolean(),
      offsetY: z.number().min(15).max(85),
    })
    .refine((d) => d.shape === 'capsule' || d.shape === 'half' || d.layout === 'list' || d.layout === 'rail' || d.showOrbit || d.showList, '图形和列表至少保留一个'),
  encourage: z
    .object({
      enabled: z.boolean(),
      intervalMinutes: z.number().min(1).max(240),
      baseChance: z.number().min(0).max(100),
      increment: z.number().min(0).max(100),
      maxChance: z.number().min(0).max(100),
      durationSeconds: z.number().min(3).max(120),
      cooldownMinutes: z.number().min(0).max(1440),
      quietOnArticle: z.boolean(),
      animation: z.enum(['rise', 'fade']),
    })
    .refine((v) => v.baseChance <= v.maxChance, '初始概率不能大于最高概率'),
  easter: z.object({
    enabled: z.boolean(),
    set: z.enum(['follow-theme', ...EGG_SETS.map((e) => e.id)] as [string, ...string[]]),
    triggers: z.object({
      logo: z.boolean(), konami: z.boolean(), hello: z.boolean(), lateNight: z.boolean(), readEnd: z.boolean(),
      avatar: z.boolean(), festival: z.boolean(), console: z.boolean(), notFound: z.boolean(),
    }),
  }),
  previewBall: z.object({
    enabled: z.boolean(),
    position: z.enum(['right', 'left']),
    shape: z.enum(['circle', 'squircle', 'pill', 'hexagon', 'leaf']),
    style: z.enum(['solid', 'glass', 'outline', 'accent']),
    size: z.enum(['sm', 'md', 'lg']),
    showLabel: z.boolean(),
    pulse: z.boolean(),
  }),
} satisfies { [K in keyof Settings]: z.ZodType };

export type SettingsKey = keyof Settings;

/** Recursively fill missing keys from defaults (plain objects only). */
export function deepMerge<T>(defaults: T, stored: unknown): T {
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(defaults) || !isObj(stored)) return (stored === undefined ? defaults : stored) as T;
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(stored)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out as T;
}

/** Map settings stored by older versions onto the current shape. */
export function migrateLegacy(key: string, stored: Record<string, unknown>): Record<string, unknown> {
  if (key === 'appearance') {
    const legacy: Record<string, string> = { blue: '#496c96', terracotta: '#99694b' };
    if (typeof stored.accent === 'string' && legacy[stored.accent] && !stored.customAccent) stored.customAccent = legacy[stored.accent];
    delete stored.accent;
    delete stored.dialStyle;
  }
  return stored;
}

export function getSetting<K extends SettingsKey>(key: K): Settings[K] {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const stored = row ? migrateLegacy(key, JSON.parse(row.value)) : {};
  const merged = deepMerge(DEFAULT_SETTINGS[key], stored);
  // Stale or invalid stored values (e.g. a removed enum option) fall back to defaults.
  return (schemas[key].safeParse(merged).success ? merged : DEFAULT_SETTINGS[key]) as Settings[K];
}

export function getAllSettings(): Settings {
  return Object.fromEntries((Object.keys(DEFAULT_SETTINGS) as SettingsKey[]).map((k) => [k, getSetting(k)])) as unknown as Settings;
}

export function setSetting<K extends SettingsKey>(key: K, raw: unknown): Settings[K] {
  const value = schemas[key].parse(raw) as Settings[K];
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  return value;
}

export function isSettingsKey(k: string): k is SettingsKey {
  return k in schemas;
}
