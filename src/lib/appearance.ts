import { cursorDataUri, getPreset, paletteVars, type ThemePreset } from './themes';

export interface AppearanceSettings {
  preset: string;
  theme: 'system' | 'light' | 'dark';
  customAccent: string;
  motion: 'off' | 'minimal' | 'normal' | 'rich';
  density: 'compact' | 'comfortable' | 'spacious';
  font: 'preset' | 'serif-sans' | 'sans' | 'serif';
  radius: 'preset' | 'sharp' | 'soft' | 'round';
  cursor: 'system' | 'dot' | 'ring' | 'theme';
  cursorTrail: boolean;
  background: {
    type: 'preset' | 'none' | 'solid' | 'gradient' | 'paper' | 'dots' | 'grid' | 'animated' | 'image';
    effect: string;
    color: string;
    gradientFrom: string;
    gradientTo: string;
    imageUrl: string;
    overlay: number;
    blur: number;
    fixed: boolean;
    intensity: 'low' | 'medium' | 'high';
  };
  iconMotion: boolean;
  cardMotion: boolean;
}

export interface ResolvedAppearance {
  preset: ThemePreset;
  attrs: Record<string, string>;
  style: string;
  bg: { type: string; effect: string | null; intensity: string };
}

const DOT = '<circle cx="12" cy="12" r="3.5" fill="ACCENT"/>';
const RING = '<circle cx="12" cy="12" r="7" fill="none" stroke="ACCENT" stroke-width="1.6"/><circle cx="12" cy="12" r="1.5" fill="ACCENT"/>';

/** CSS `cursor` value for the given settings, or null for the system cursor. */
export function cursorCss(a: Pick<AppearanceSettings, 'cursor' | 'preset' | 'customAccent'>): string | null {
  if (a.cursor === 'system') return null;
  const p = getPreset(a.preset);
  const accent = a.customAccent || p.light.accent;
  const glyph = a.cursor === 'theme' ? p.cursorGlyph : (a.cursor === 'dot' ? DOT : RING).replace(/ACCENT/g, accent);
  return cursorDataUri(glyph);
}

/**
 * Stored appearance settings → SSR attributes + a style attribute.
 * Every value interpolated into the style string is validated upstream
 * (hex colors, enums, /uploads/ or http(s) URLs), so no CSS injection.
 */
export function resolveAppearance(a: AppearanceSettings, theme: 'light' | 'dark' | 'auto'): ResolvedAppearance {
  const p = getPreset(a.preset);
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(paletteVars(p.light, a.customAccent || null))) vars[k.replace('--', '--l-')] = v;
  for (const [k, v] of Object.entries(paletteVars(p.dark, a.customAccent || null))) vars[k.replace('--', '--d-')] = v;

  const fromPreset = a.background.type === 'preset';
  const bgType = fromPreset ? p.background.type : a.background.type;
  const effect = fromPreset ? (p.background.effect ?? null) : bgType === 'animated' ? a.background.effect : null;

  if (bgType === 'solid') vars['--page-bg'] = a.background.color;
  if (bgType === 'gradient') vars['--page-bg'] = `linear-gradient(160deg, ${a.background.gradientFrom}, ${a.background.gradientTo})`;
  if (bgType === 'image' && a.background.imageUrl) {
    vars['--page-img'] = `url("${a.background.imageUrl.replace(/["\\\n()]/g, '')}")`;
    vars['--page-overlay'] = String(a.background.overlay);
    vars['--page-blur'] = `${a.background.blur}px`;
  }
  const cursor = cursorCss(a);
  if (cursor) vars['--cursor'] = cursor;

  return {
    preset: p,
    attrs: {
      'data-theme': theme,
      'data-preset': p.id,
      'data-motion': a.motion,
      'data-density': a.density,
      'data-font': a.font === 'preset' ? p.font : a.font,
      'data-radius': a.radius === 'preset' ? p.radius : a.radius,
      'data-bg': bgType === 'image' && !a.background.imageUrl ? 'none' : bgType,
      'data-cursor': a.cursor,
      'data-icon-motion': a.iconMotion ? 'on' : 'off',
      'data-card-motion': a.cardMotion ? 'on' : 'off',
      ...(bgType === 'image' && a.background.fixed ? { 'data-bg-fixed': '' } : {}),
    },
    style: Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';'),
    bg: { type: bgType, effect, intensity: a.background.intensity },
  };
}
