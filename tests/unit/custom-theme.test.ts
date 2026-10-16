import { describe, expect, it } from 'vitest';
import { checkThemeCss, pickTheme, rotationSchema, themeSchema } from '../../src/lib/custom-theme';

describe('custom theme CSS check', () => {
  it('scopes plain rules under the custom theme', () => {
    const r = checkThemeCss('.post-title { color: #c00; }\n:root { --accent: #123456; }');
    expect(r.ok).toBe(true);
    expect(r.css).toContain('html[data-custom-theme] .post-title {');
    expect(r.css).toContain('html[data-custom-theme] {');
  });

  it('scopes rules inside @media and keeps keyframes', () => {
    const r = checkThemeCss('@media (max-width: 600px) { .hero h1 { font-size: 28px; } }\n@keyframes spin { to { transform: rotate(1turn); } }');
    expect(r.ok).toBe(true);
    expect(r.css).toMatch(/@media \(max-width: 600px\) \{\nhtml\[data-custom-theme\] \.hero h1/);
    expect(r.css).toContain('@keyframes spin');
  });

  it.each([
    ['@import url(https://evil.example/x.css);', '@import'],
    ['.a { background: url(https://evil.example/t.png); }', 'url('],
    ['.a { width: expression(alert(1)); }', 'expression'],
    ['.a { color: red; ', '花括号'],
    ['body { display: none; }', '隐藏整个页面'],
    ['.cover { position: fixed; inset: 0; background: #000; }', 'pointer-events'],
    ['.a { z-index: 99999; }', 'z-index'],
  ])('rejects %s', (css, msg) => {
    const r = checkThemeCss(css);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain(msg);
  });

  it('allows /uploads/ assets and full-screen overlays that ignore the pointer', () => {
    const r = checkThemeCss('.x { background: url(/uploads/abc123.webp); }\n.veil { position: fixed; inset: 0; pointer-events: none; }');
    expect(r.ok).toBe(true);
  });

  it('ignores selectors that target the workspace', () => {
    const r = checkThemeCss('.owner-nav, .post { color: red; }');
    expect(r.ok).toBe(true);
    expect(r.css).not.toContain('owner-nav');
    expect(r.warnings.length).toBe(1);
  });
});

describe('theme schema', () => {
  it('fills defaults from a minimal file', () => {
    const t = themeSchema.parse({ name: '我的主题' });
    expect(t.base).toBe('ink');
    expect(t.background.use).toBe('inherit');
    expect(t.format).toBe('fieldnotes-theme@1');
  });

  it('rejects external fonts and bad colours', () => {
    expect(() => themeSchema.parse({ name: 'x', typography: { displayFont: 'javascript:alert(1)' } })).toThrow();
    expect(() => themeSchema.parse({ name: 'x', palette: { light: { bg: 'red' } } })).toThrow();
  });
});

describe('theme rotation', () => {
  const valid = () => true;
  const r = (x: unknown) => rotationSchema.parse(x);

  it('fixed keeps the base', () => {
    expect(pickTheme('ink', r({ mode: 'fixed', pool: ['ocean'] }), new Date(), valid)).toBe('ink');
  });

  it('random is stable within a day', () => {
    const rot = r({ mode: 'random', pool: ['ocean', 'forest', 'meadow'] });
    const a = pickTheme('ink', rot, new Date('2026-10-16T08:00:00'), valid);
    const b = pickTheme('ink', rot, new Date('2026-10-16T09:30:00'), valid);
    expect(a).toBe(b);
    expect(['ocean', 'forest', 'meadow']).toContain(a);
  });

  it('rotate cycles every N days', () => {
    const rot = r({ mode: 'rotate', pool: ['a', 'b'], everyDays: 1 });
    const d1 = pickTheme('ink', rot, new Date(Date.UTC(2026, 0, 1, 12)), valid);
    const d2 = pickTheme('ink', rot, new Date(Date.UTC(2026, 0, 2, 12)), valid);
    expect(d1).not.toBe(d2);
  });

  it('schedule matches time windows past midnight and date ranges past new year', () => {
    const rot = r({ mode: 'schedule', rules: [{ theme: 'starry', time: '22:00-06:00' }, { theme: 'snow', dates: '12-20..01-05' }] });
    expect(pickTheme('ink', rot, new Date('2026-10-16T23:30:00'), valid)).toBe('starry');
    expect(pickTheme('ink', rot, new Date('2026-10-16T03:00:00'), valid)).toBe('starry');
    expect(pickTheme('ink', rot, new Date('2026-12-28T12:00:00'), valid)).toBe('snow');
    expect(pickTheme('ink', rot, new Date('2027-01-03T12:00:00'), valid)).toBe('snow');
    expect(pickTheme('ink', rot, new Date('2026-10-16T12:00:00'), valid)).toBe('ink');
  });

  it('skips themes that no longer exist', () => {
    const rot = r({ mode: 'random', pool: ['gone'] });
    expect(pickTheme('ink', rot, new Date(), (id) => id !== 'gone')).toBe('ink');
  });
});
