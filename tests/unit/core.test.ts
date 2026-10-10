import { describe, expect, it } from 'vitest';
import { currentStreak, daysSince, distinctDays, longestStreak, addDays } from '../../src/lib/stats';
import { initialState, roll, type EncourageConfig, type EncourageState } from '../../src/lib/encourage';
import { renderMarkdown } from '../../src/lib/markdown/render';
import { parseMarkdownImport, toMarkdownFile } from '../../src/lib/markdown/frontmatter';
import { isPublicPost, hiddenReason } from '../../src/server/visibility';
import { postInput } from '../../src/server/validation';

describe('stats', () => {
  it('daysSince is inclusive and never negative', () => {
    expect(daysSince('2026-01-01', '2026-01-01')).toBe(1);
    expect(daysSince('2026-01-01', '2026-01-31')).toBe(31);
    expect(daysSince('2026-02-01', '2026-01-31')).toBe(0);
  });
  it('addDays crosses months/years', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('publish days count distinct dates, not posts', () => {
    expect(distinctDays(['2026-01-01', '2026-01-01', '2026-01-03'])).toBe(2);
  });
  it('current streak with grace for today', () => {
    const days = ['2026-03-01', '2026-03-02', '2026-03-03'];
    expect(currentStreak(days, '2026-03-03')).toBe(3);
    expect(currentStreak(days, '2026-03-04')).toBe(3); // today not yet recorded
    expect(currentStreak(days, '2026-03-04', false)).toBe(0);
    expect(currentStreak(days, '2026-03-05')).toBe(0);
  });
  it('longest streak', () => {
    expect(longestStreak(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07'])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe('encouragement probability', () => {
  const cfg: EncourageConfig = { baseChance: 10, increment: 5, maxChance: 25, intervalMinutes: 5, cooldownMinutes: 30 };

  it('grows by increment on misses and caps at max', () => {
    let s = initialState(cfg);
    const chances: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = roll(cfg, s, i * 300_000, () => 0.99);
      expect(r.show).toBe(false);
      s = r.state;
      chances.push(s.chance);
    }
    expect(chances).toEqual([15, 20, 25, 25, 25, 25]);
  });

  it('resets on hit and respects cooldown', () => {
    let s: EncourageState = { chance: 25, lastShownAt: null };
    const hit = roll(cfg, s, 0, () => 0.1);
    expect(hit.show).toBe(true);
    expect(hit.state.chance).toBe(10);
    s = hit.state;
    const during = roll(cfg, s, 10 * 60_000, () => 0);
    expect(during.show).toBe(false);
    const after = roll(cfg, s, 31 * 60_000, () => 0);
    expect(after.show).toBe(true);
  });

  it('chance 0 never fires', () => {
    const c = { ...cfg, baseChance: 0, increment: 0 };
    expect(roll(c, initialState(c), 0, () => 0).show).toBe(false);
  });
});

describe('visibility predicate', () => {
  const ok = { status: 'published', visibility: 'public', publishedAt: '2026-01-01T00:00:00.000Z', categoryVisibility: 'public', siteVisibility: 'public' };
  const at = new Date('2026-06-01');
  it('requires every condition', () => {
    expect(isPublicPost(ok, at)).toBe(true);
    expect(isPublicPost({ ...ok, status: 'draft' }, at)).toBe(false);
    expect(isPublicPost({ ...ok, visibility: 'private' }, at)).toBe(false);
    expect(isPublicPost({ ...ok, categoryVisibility: 'private' }, at)).toBe(false);
    expect(isPublicPost({ ...ok, siteVisibility: 'private' }, at)).toBe(false);
    expect(isPublicPost({ ...ok, publishedAt: '2027-01-01T00:00:00.000Z' }, at)).toBe(false);
    expect(hiddenReason({ ...ok, publishedAt: '2027-01-01T00:00:00.000Z' }, at)).toBe('定时发布中');
  });
});

describe('markdown pipeline', () => {
  it('renders gfm, math, code and toc', async () => {
    const r = await renderMarkdown('## 一、背景\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n$x^2$\n\n```ts\nconst a = 1\n```\n');
    expect(r.html).toContain('<table');
    expect(r.html).toContain('katex');
    expect(r.html).toContain('shiki');
    expect(r.toc).toEqual([{ depth: 2, id: '一背景', text: '一、背景' }]);
  });
  it('strips scripts, handlers and dangerous protocols', async () => {
    const r = await renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[x](javascript:alert(1)) <a href="vbscript:x">v</a>\n\n<iframe src="https://evil"></iframe>',
    );
    expect(r.html).not.toMatch(/<script|onerror|javascript:|vbscript:|<iframe/i);
  });
  it('external links get rel=noopener', async () => {
    const r = await renderMarkdown('[a](https://example.com)');
    expect(r.html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe('markdown import', () => {
  it('reads front matter', () => {
    const r = parseMarkdownImport('---\ntitle: 你好\ntags: [a, b]\ndate: 2026-02-03\nsummary: 摘要\nslug: hello-world\n---\n\n正文', 'x.md');
    expect(r).toMatchObject({ title: '你好', tags: ['a', 'b'], summary: '摘要', slug: 'hello-world', body: '正文' });
    expect(r.date).toBe('2026-02-03T00:00:00.000Z');
  });
  it('falls back to H1 then filename', () => {
    expect(parseMarkdownImport('# 标题\n\n内容').title).toBe('标题');
    expect(parseMarkdownImport('内容', '我的笔记.md').title).toBe('我的笔记');
  });
  it('tolerates broken front matter and warns about local images', () => {
    const r = parseMarkdownImport('---\n: : bad: [\n---\n![](./a.png)');
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
  });
  it('round-trips through export', () => {
    const md = toMarkdownFile({ title: 'T', slug: 't', summary: 's', tags: ['x'], publishedAt: '2026-01-01T00:00:00.000Z', bodyMd: 'body' });
    const r = parseMarkdownImport(md);
    expect(r).toMatchObject({ title: 'T', slug: 't', summary: 's', tags: ['x'], body: 'body\n' });
  });
});

describe('validation', () => {
  it('requires http(s) links', () => {
    const p = { title: 't', categoryId: 'c' };
    expect(postInput.safeParse({ ...p, links: [{ label: 'a', url: 'https://x.dev' }] }).success).toBe(true);
    expect(postInput.safeParse({ ...p, links: [{ label: 'a', url: 'javascript:alert(1)' }] }).success).toBe(false);
    expect(postInput.safeParse({ ...p, links: [{ label: 'a', url: 'ftp://x' }] }).success).toBe(false);
  });
});
