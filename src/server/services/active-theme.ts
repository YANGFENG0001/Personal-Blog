/**
 * Which theme is live right now: the owner's chosen theme, possibly replaced
 * by the rotation rules (random / rotate / schedule). Custom themes are
 * loaded here so layouts get a ready-to-render appearance.
 */
import { pickTheme, type CustomTheme } from '../../lib/custom-theme';
import { PRESET_IDS } from '../../lib/themes';
import type { AppearanceSettings } from '../../lib/appearance';
import { getSetting } from './settings';
import { getTheme } from './custom-themes';

const isPreset = (id: string) => (PRESET_IDS as readonly string[]).includes(id);

export function themeExists(id: string): boolean {
  if (isPreset(id)) return true;
  return id.startsWith('custom:') && !!getTheme(id.slice(7));
}

/** Load the custom theme for a `custom:<id>` preset value (null for built-ins or missing themes). */
export function customFor(id: string): CustomTheme | null {
  if (!id.startsWith('custom:')) return null;
  return getTheme(id.slice(7));
}

/**
 * The appearance to render for a public page, after rotation.
 * `preview` (owner only) forces a theme id for the live preview iframe.
 */
export function activeAppearance(now = new Date(), preview?: string | null, eggTheme?: string | null): { appearance: AppearanceSettings; custom: CustomTheme | null; themeId: string } {
  const a = getSetting('appearance') as AppearanceSettings;
  const rotation = getSetting('themeRotation');
  let id = a.preset;
  // An easter-egg switch only honours themes the owner listed for eggs.
  const egg = eggTheme && rotation.eggs.some((e) => e.theme === eggTheme) && themeExists(eggTheme) ? eggTheme : null;
  if (preview && themeExists(preview)) id = preview;
  else if (egg) id = egg;
  else id = pickTheme(a.preset, rotation, now, themeExists);
  const custom = customFor(id);
  // A deleted custom theme falls back to the default preset.
  const presetId = custom ? id : isPreset(id) ? id : 'ink';
  return { appearance: { ...a, preset: presetId }, custom, themeId: presetId };
}
