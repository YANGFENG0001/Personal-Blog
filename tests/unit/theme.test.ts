import { describe, expect, it } from 'vitest';
import { PRESETS, contrast, getPreset, mix } from '../../src/lib/themes';
import { resolveAppearance, cursorCss } from '../../src/lib/appearance';
import { toggleChip } from '../../src/components/owner/ui';
import { dueInfo } from '../../src/components/owner/TaskBoards';
import { deepMerge, migrateLegacy } from '../../src/server/services/settings';
import { DEFAULT_SETTINGS } from '../../src/server/seed';

describe('theme presets', () => {
  it('have unique ids and every palette key', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) for (const pal of [p.light, p.dark]) {
      for (const k of ['bg', 'surface', 'ink', 'muted', 'faint', 'line', 'pane', 'accent', 'tint'] as const) expect(pal[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(PRESETS.map((p) => [p.name, p] as const))('%s meets WCAG AA for text', (_n, p) => {
    for (const pal of [p.light, p.dark]) {
      expect(contrast(pal.ink, pal.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(pal.muted, pal.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(pal.faint, pal.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(pal.accent, pal.bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it('falls back to the default preset for unknown ids', () => {
    expect(getPreset('nope').id).toBe('ink');
  });

  it('mixes colors', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('resolveAppearance', () => {
  const base = DEFAULT_SETTINGS.appearance;

  it('emits SSR attributes and palette variables', () => {
    const r = resolveAppearance({ ...base, preset: 'ocean' }, 'auto');
    expect(r.attrs['data-preset']).toBe('ocean');
    expect(r.attrs['data-bg']).toBe('scene');
    expect(r.bg.scene).toBe('ocean');
    expect(r.bg.effect).toBe('glints');
    expect(r.style).toContain('--l-accent:#1f6e8c');
    expect(r.style).toContain('--d-bg:');
  });

  it('applies a custom accent to both modes', () => {
    const r = resolveAppearance({ ...base, customAccent: '#aa3366' }, 'light');
    expect(r.style).toContain('--l-accent:#aa3366');
    expect(r.style).toContain('--d-accent:#aa3366');
  });

  it('honours explicit background/font/radius overrides', () => {
    const r = resolveAppearance({ ...base, preset: 'paper', font: 'sans', radius: 'round', background: { ...base.background, type: 'gradient' } }, 'dark');
    expect(r.attrs['data-font']).toBe('sans');
    expect(r.attrs['data-radius']).toBe('round');
    expect(r.attrs['data-bg']).toBe('gradient');
    expect(r.style).toContain('--page-bg:linear-gradient');
  });

  it('treats an image background without a URL as none', () => {
    const r = resolveAppearance({ ...base, background: { ...base.background, type: 'image', imageUrl: '' } }, 'light');
    expect(r.attrs['data-bg']).toBe('none');
  });

  it('resolves an explicit scene background with its own effect', () => {
    const r = resolveAppearance({ ...base, background: { ...base.background, type: 'scene', scene: 'forest' } }, 'light');
    expect(r.attrs['data-bg']).toBe('scene');
    expect(r.bg.scene).toBe('forest');
    expect(r.bg.effect).toBe('motes');
  });

  it('shows the mascot only when the preset or the owner asks for it', () => {
    expect(resolveAppearance({ ...base, preset: 'ink' }, 'auto').mascot).toBeNull();
    expect(resolveAppearance({ ...base, preset: 'summer' }, 'auto').mascot).toMatchObject({ character: 'chibi', position: 'right', size: 'md', imageUrl: '', draggable: true });
    expect(resolveAppearance({ ...base, preset: 'sakura' }, 'auto').mascot?.character).toBe('haru');
    expect(resolveAppearance({ ...base, preset: 'tenki' }, 'auto').mascot?.character).toBe('sora');
    expect(resolveAppearance({ ...base, preset: 'tenki', mascot: { ...base.mascot, character: 'haru' } }, 'auto').mascot?.character).toBe('haru');
    expect(resolveAppearance({ ...base, preset: 'summer', mascot: { ...base.mascot, mode: 'off' } }, 'auto').mascot).toBeNull();
    expect(resolveAppearance({ ...base, mascot: { ...base.mascot, mode: 'on', imageUrl: '/uploads/a.png' } }, 'auto').mascot?.imageUrl).toBe('/uploads/a.png');
  });

  it('builds cursor data URIs only when not system', () => {
    expect(cursorCss({ cursor: 'system', preset: 'ink', customAccent: '' })).toBeNull();
    expect(cursorCss({ cursor: 'theme', preset: 'anime', customAccent: '' })).toMatch(/^url\("data:image\/svg\+xml,/);
  });
});

describe('settings upgrade', () => {
  it('deep-merges new default keys into old stored values', () => {
    const merged = deepMerge(DEFAULT_SETTINGS.appearance, { motion: 'minimal', background: { type: 'dots' } });
    expect(merged.motion).toBe('minimal');
    expect(merged.background.type).toBe('dots');
    expect(merged.background.overlay).toBe(DEFAULT_SETTINGS.appearance.background.overlay);
    expect(merged.preset).toBe('ink');
  });

  it('maps the legacy accent option to a custom accent', () => {
    const m = migrateLegacy('appearance', { accent: 'blue', dialStyle: 'arc' });
    expect(m).toEqual({ customAccent: '#496c96' });
  });
});

describe('ChipToggle state', () => {
  it('"all" clears selection; removing the last chip returns to all', () => {
    expect(toggleChip(null, 'a')).toEqual(['a']);
    expect(toggleChip(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleChip(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleChip(['b'], 'b')).toBeNull();
    expect(toggleChip(['a', 'b'], null)).toBeNull();
  });
});

describe('task due labels', () => {
  const today = new Date('2026-05-10T09:00:00');
  it('describes relative due dates', () => {
    expect(dueInfo('2026-05-08', false, today)).toEqual({ text: '逾期 2 天', cls: 'overdue' });
    expect(dueInfo('2026-05-10', false, today)).toEqual({ text: '今天', cls: 'today' });
    expect(dueInfo('2026-05-11', false, today)?.text).toBe('明天');
    expect(dueInfo('2026-05-14', false, today)?.text).toBe('4 天后');
    expect(dueInfo('2026-06-01', false, today)?.text).toBe('06/01');
    expect(dueInfo('2026-05-08', true, today)).toEqual({ text: '05/08', cls: '' });
    expect(dueInfo(null, false, today)).toBeNull();
  });
});
