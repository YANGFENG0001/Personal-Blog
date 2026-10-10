import { z } from 'zod';
import { getDb } from '../db';
import { DEFAULT_SETTINGS, type Settings } from '../seed';
import { httpUrl, imageUrl } from '../validation';

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
    theme: z.enum(['system', 'light', 'dark']),
    accent: z.enum(['green', 'blue', 'terracotta']),
    motion: z.enum(['normal', 'minimal', 'off']),
    dialStyle: z.enum(['orbit', 'arc']),
    density: z.enum(['comfortable', 'compact']),
  }),
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
  easter: z.object({ enabled: z.boolean() }),
  previewBall: z.object({ enabled: z.boolean(), position: z.enum(['right', 'left']) }),
} satisfies { [K in keyof Settings]: z.ZodType };

export type SettingsKey = keyof Settings;

export function getSetting<K extends SettingsKey>(key: K): Settings[K] {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  const stored = row ? JSON.parse(row.value) : {};
  // Merge over defaults so newly added fields get sane values after upgrades.
  return { ...DEFAULT_SETTINGS[key], ...stored } as Settings[K];
}

export function getAllSettings(): Settings {
  return Object.fromEntries(
    (Object.keys(DEFAULT_SETTINGS) as SettingsKey[]).map((k) => [k, getSetting(k)]),
  ) as unknown as Settings;
}

export function setSetting<K extends SettingsKey>(key: K, raw: unknown): Settings[K] {
  const schema = schemas[key];
  if (!schema) throw new Error(`unknown setting ${key}`);
  const value = schema.parse(raw) as Settings[K];
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  return value;
}

export function isSettingsKey(k: string): k is SettingsKey {
  return k in schemas;
}

/** The subset of settings safe to embed in public pages. */
export function publicSettings() {
  const s = getAllSettings();
  return {
    site: s.site,
    profile: s.profile.public ? s.profile : null,
    appearance: s.appearance,
    encourage: s.encourage,
    easter: s.easter,
  };
}
