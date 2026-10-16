import { cursorDataUri, getPreset, paletteVars, type ThemePreset } from './themes';
import type { CustomTheme, ThemeLayer } from './custom-theme';
import { getScene } from './scenes';

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
    type: 'preset' | 'none' | 'solid' | 'gradient' | 'paper' | 'dots' | 'grid' | 'animated' | 'image' | 'scene';
    effect: string;
    scene: string;
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
  mascot: { mode: 'preset' | 'on' | 'off'; character: string; draggable: boolean; imageUrl: string; position: 'right' | 'left'; size: 'sm' | 'md' | 'lg' };
}

export interface ResolvedAppearance {
  preset: ThemePreset;
  attrs: Record<string, string>;
  style: string;
  bg: { type: string; effect: string | null; intensity: string; scene: string | null };
  /** The custom theme being applied (layers, stickers, particles, css), or null for built-in presets. */
  custom: CustomTheme | null;
  /**
   * Mascot to render, or null. character is a built-in id or `pack:<id>`
   * (resolved server-side by the layout). imageUrl is a legacy single-image override.
   */
  mascot: { character: string; draggable: boolean; imageUrl: string; position: 'right' | 'left'; size: 'sm' | 'md' | 'lg' } | null;
}

const DOT = '<circle cx="12" cy="12" r="3.5" fill="ACCENT"/>';
const RING = '<circle cx="12" cy="12" r="7" fill="none" stroke="ACCENT" stroke-width="1.6"/><circle cx="12" cy="12" r="1.5" fill="ACCENT"/>';

/** CSS `cursor` value for the given settings, or null for the system cursor. */
export function cursorCss(a: Pick<AppearanceSettings, 'cursor' | 'preset' | 'customAccent'>, preset?: ThemePreset): string | null {
  if (a.cursor === 'system') return null;
  const p = preset ?? getPreset(a.preset);
  const accent = a.customAccent || p.light.accent;
  const glyph = a.cursor === 'theme' ? p.cursorGlyph : (a.cursor === 'dot' ? DOT : RING).replace(/ACCENT/g, accent);
  return cursorDataUri(glyph);
}

/**
 * Stored appearance settings → SSR attributes + a style attribute.
 * Every value interpolated into the style string is validated upstream
 * (hex colors, enums, /uploads/ or http(s) URLs), so no CSS injection.
 */
/** A url() value; inputs are validated upstream, quotes/brackets stripped as a second guard. */
const cssUrl = (u: string) => `url("${u.replace(/["\\\n()]/g, '')}")`;

/**
 * Merge a custom theme over its base preset: the result is a regular preset
 * (so everything downstream keeps working) plus the custom extras.
 */
export function mergeCustom(t: CustomTheme): ThemePreset {
  const base = getPreset(t.base);
  const ty = t.typography;
  const font: ThemePreset['font'] =
    !ty.display && !ty.body ? base.font : (ty.display ?? 'serif') === 'sans' ? 'sans' : (ty.body ?? 'sans') === 'serif' ? 'serif' : 'serif-sans';
  return {
    ...base,
    name: t.name,
    description: t.description || base.description,
    light: { ...base.light, ...(t.palette.light ?? {}) },
    dark: { ...base.dark, ...(t.palette.dark ?? {}) },
    font,
    radius: t.shape.radius ?? base.radius,
    background: t.background.use === 'layers' ? { type: 'none' } : base.background,
    eggSet: (t.eggSet as ThemePreset['eggSet']) || base.eggSet,
    mascot: t.mascot !== undefined ? (t.mascot as ThemePreset['mascot']) : base.mascot,
  };
}

/** CSS variables for one background layer (rendered as a .theme-layer element). */
export function layerStyle(l: ThemeLayer): string {
  const v: string[] = [];
  if (l.kind === 'image' && l.src) v.push(`--tl-img:${cssUrl(l.src)}`);
  if (l.kind === 'image' && l.srcDark) v.push(`--tl-img-dark:${cssUrl(l.srcDark)}`);
  if (l.kind === 'gradient' && l.from && l.to) v.push(`--tl-img:linear-gradient(${l.angle}deg, ${l.from}, ${l.to})`);
  v.push(
    `--tl-pos:${l.position.replace('-', ' ')}`,
    `--tl-size:${l.size === 'width' ? '100% auto' : l.size}`,
    `--tl-repeat:${l.repeat ? 'repeat' : 'no-repeat'}`,
    `--tl-opacity:${l.opacity}`,
    `--tl-blend:${l.blend}`,
    `--tl-depth:${l.depth}`,
  );
  return v.join(';');
}

export function resolveAppearance(a: AppearanceSettings, theme: 'light' | 'dark' | 'auto', custom: CustomTheme | null = null): ResolvedAppearance {
  const p = custom ? mergeCustom(custom) : getPreset(a.preset);
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(paletteVars(p.light, a.customAccent || null))) vars[k.replace('--', '--l-')] = v;
  for (const [k, v] of Object.entries(paletteVars(p.dark, a.customAccent || null))) vars[k.replace('--', '--d-')] = v;

  const fromPreset = a.background.type === 'preset';
  const bgType = fromPreset ? p.background.type : a.background.type;
  const sceneId = bgType === 'scene' ? (fromPreset ? p.background.scene : a.background.scene) ?? null : null;
  const scene = sceneId ? getScene(sceneId) : undefined;
  const effect = fromPreset
    ? (p.background.effect ?? null)
    : bgType === 'animated' ? a.background.effect : bgType === 'scene' ? (scene?.effect ?? null) : null;

  if (bgType === 'solid') vars['--page-bg'] = a.background.color;
  if (bgType === 'gradient') vars['--page-bg'] = `linear-gradient(160deg, ${a.background.gradientFrom}, ${a.background.gradientTo})`;
  if (bgType === 'image' && a.background.imageUrl) {
    vars['--page-img'] = `url("${a.background.imageUrl.replace(/["\\\n()]/g, '')}")`;
    vars['--page-overlay'] = String(a.background.overlay);
    vars['--page-blur'] = `${a.background.blur}px`;
  }
  const cursor = custom?.cursor.src && a.cursor === 'theme' ? `${cssUrl(custom.cursor.src)} ${custom.cursor.hotspot[0]} ${custom.cursor.hotspot[1]}, auto` : cursorCss(a, p);
  if (cursor) vars['--cursor'] = cursor;
  if (custom) {
    const ty = custom.typography;
    if (ty.scale !== 1) vars['--type-scale'] = String(ty.scale);
    if (ty.lineHeight) vars['--lh-prose'] = String(ty.lineHeight);
    if (ty.headingWeight) vars['--heading-weight'] = String(ty.headingWeight);
    if (ty.letterSpacing) vars['--heading-tracking'] = `${ty.letterSpacing}em`;
    vars['--border-w'] = `${custom.shape.border}px`;
    vars['--reading-panel'] = `${Math.round(custom.background.readingPanel * 100)}%`;
    vars['--reading-blur'] = `${custom.background.blur}px`;
    for (const st of custom.stickers) {
      vars[`--sticker-${st.slot}`] = cssUrl(st.src);
      vars[`--sticker-${st.slot}-size`] = `${st.size}px`;
      vars[`--sticker-${st.slot}-opacity`] = String(st.opacity);
      vars[`--sticker-${st.slot}-rotate`] = `${st.rotate}deg`;
    }
  }

  return {
    preset: p,
    attrs: {
      'data-theme': theme,
      'data-preset': p.id,
      'data-motion': a.motion,
      'data-density': a.density,
      'data-font': a.font === 'preset' ? p.font : a.font,
      'data-radius': a.radius === 'preset' ? p.radius : a.radius,
      'data-bg': (bgType === 'image' && !a.background.imageUrl) || (bgType === 'scene' && !scene) ? 'none' : bgType,
      'data-cursor': a.cursor,
      'data-icon-motion': a.iconMotion ? 'on' : 'off',
      'data-card-motion': a.cardMotion ? 'on' : 'off',
      ...(bgType === 'image' && a.background.fixed ? { 'data-bg-fixed': '' } : {}),
      ...(custom
        ? {
            'data-custom-theme': '',
            'data-shadow': custom.shape.shadow,
            ...(custom.background.use === 'layers' && custom.background.layers.length ? { 'data-layers': '' } : {}),
            // The theme's density applies unless the owner picked one explicitly.
            ...(custom.shape.density && a.density === 'comfortable' ? { 'data-density': custom.shape.density } : {}),
            ...(custom.typography.display === 'custom' && custom.typography.displayFont ? { 'data-font-display': 'custom' } : {}),
            ...(custom.typography.body === 'custom' && custom.typography.bodyFont ? { 'data-font-body': 'custom' } : {}),
            ...(custom.stickers.length ? { 'data-stickers': custom.stickers.map((x) => x.slot).join(' ') } : {}),
          }
        : {}),
    },
    style: Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';'),
    bg: {
      type: bgType,
      // A custom theme can replace the particle effect or turn it off.
      effect: custom && custom.particles.use !== 'inherit' ? (custom.particles.use === 'builtin' ? (custom.particles.effect ?? null) : null) : effect,
      intensity: a.background.intensity,
      scene: scene ? scene.id : null,
    },
    custom,
    mascot: (a.mascot.mode === 'on' || (a.mascot.mode === 'preset' && p.mascot))
      ? {
          character: a.mascot.character === 'preset' ? (p.mascot ?? 'haru') : a.mascot.character,
          draggable: a.mascot.draggable,
          imageUrl: a.mascot.imageUrl,
          position: a.mascot.position,
          size: a.mascot.size,
        }
      : null,
  };
}
