import { beforeEach, describe, expect, it } from 'vitest';
import { catId, freshDb } from '../helpers';
import {
  deletePost, getPost, getPublicPost, listPublicArchive, listPublicPosts, listPublicTags, savePost, searchPublicPosts,
  findPublicPostPath,
} from '../../src/server/services/posts';
import { getDb } from '../../src/server/db';
import { publicStats } from '../../src/server/services/stats';

const SECRET = 'zebra-secret-phrase';

function base(over: Record<string, unknown> = {}) {
  return {
    title: 'Attention 精读',
    categoryId: catId('research', 'papers'),
    tags: ['transformer'],
    visibility: 'public',
    bodyMd: `# 正文\n\n${SECRET}`,
    reflectionMd: '私人心得 private-reflection',
    links: [{ label: 'arXiv', url: 'https://arxiv.org/abs/1706.03762' }],
    ...over,
  };
}

function everythingPublic(): string {
  const posts = listPublicPosts({ limit: 1000 }).items;
  return JSON.stringify([posts, listPublicArchive(), listPublicTags(), searchPublicPosts(SECRET), searchPublicPosts('精读')]);
}

describe('post lifecycle & visibility gate', () => {
  beforeEach(() => freshDb());

  it('draft → publish → unpublish controls visitor access', async () => {
    const draft = await savePost(null, base(), 'save');
    expect(draft.status).toBe('draft');
    expect(getPublicPost('research', 'papers', draft.slug)).toBeUndefined();
    expect(everythingPublic()).not.toContain(draft.id);

    const pub = await savePost(draft.id, base(), 'publish');
    expect(pub.status).toBe('published');
    expect(pub.publishedAt).toBeTruthy();
    expect(getPublicPost('research', 'papers', pub.slug)?.title).toBe('Attention 精读');
    expect(searchPublicPosts(SECRET).map((p) => p.id)).toContain(pub.id);

    const firstPublished = pub.publishedAt;
    const again = await savePost(pub.id, base({ title: '更新后的标题' }), 'publish');
    expect(again.publishedAt).toBe(firstPublished); // first publish time is kept

    const withdrawn = await savePost(pub.id, base(), 'unpublish');
    expect(withdrawn.status).toBe('draft');
    expect(getPublicPost('research', 'papers', pub.slug)).toBeUndefined();
    expect(everythingPublic()).not.toContain(pub.id);
  });

  it('published but private posts stay hidden everywhere', async () => {
    const p = await savePost(null, base({ visibility: 'private' }), 'publish');
    expect(p.status).toBe('published');
    expect(getPublicPost('research', 'papers', p.slug)).toBeUndefined();
    expect(everythingPublic()).not.toContain(SECRET);
    expect(searchPublicPosts(SECRET)).toHaveLength(0);
    expect(findPublicPostPath(p.slug)).toBeUndefined();
  });

  it('hiding the category or site hides its posts', async () => {
    const p = await savePost(null, base(), 'publish');
    const db = getDb();
    db.prepare(`UPDATE categories SET visibility = 'private' WHERE id = ?`).run(p.categoryId);
    expect(getPublicPost('research', 'papers', p.slug)).toBeUndefined();
    expect(everythingPublic()).not.toContain(p.id);

    db.prepare(`UPDATE categories SET visibility = 'public' WHERE id = ?`).run(p.categoryId);
    db.prepare(`UPDATE sites SET visibility = 'private' WHERE id = ?`).run(p.siteId);
    expect(getPublicPost('research', 'papers', p.slug)).toBeUndefined();
    expect(everythingPublic()).not.toContain(p.id);
  });

  it('scheduled posts appear only after their publish time', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const p = await savePost(null, base({ publishedAt: future }), 'publish');
    expect(getPublicPost('research', 'papers', p.slug)).toBeUndefined();
    getDb().prepare('UPDATE posts SET published_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), p.id);
    expect(getPublicPost('research', 'papers', p.slug)).toBeDefined();
  });

  it('redacts markdown source and private reflection from public reads', async () => {
    const p = await savePost(null, base(), 'publish');
    const pub = getPublicPost('research', 'papers', p.slug)!;
    expect(pub.bodyMd).toBe('');
    expect(pub.reflectionMd).toBe('');
    expect(pub.reflectionHtml).toBe('');
    expect(pub.links).toHaveLength(1);

    await savePost(p.id, base({ reflectionPublic: true }), 'save');
    expect(getPublicPost('research', 'papers', p.slug)!.reflectionHtml).toContain('private-reflection');
  });

  it('keeps old slugs working after a rename', async () => {
    const p = await savePost(null, base({ slug: 'old-slug' }), 'publish');
    await savePost(p.id, base({ slug: 'new-slug' }), 'save');
    expect(findPublicPostPath('old-slug')).toBe('/research/papers/new-slug');
    expect(getPost(p.id)!.slug).toBe('new-slug');
  });

  it('rejects unsafe related links', async () => {
    await expect(savePost(null, base({ links: [{ label: 'x', url: 'javascript:alert(1)' }] }))).rejects.toThrow();
    await expect(savePost(null, base({ links: [{ label: 'x', url: 'data:text/html,hi' }] }))).rejects.toThrow();
  });

  it('sanitizes HTML in markdown', async () => {
    const p = await savePost(null, base({ bodyMd: '<script>alert(1)</script><img src=x onerror=alert(1)>[a](javascript:alert(1))' }));
    expect(p.bodyHtml).not.toMatch(/<script|onerror|javascript:/i);
  });

  it('deletes posts and their search entries', async () => {
    const p = await savePost(null, base(), 'publish');
    deletePost(p.id);
    expect(getPost(p.id)).toBeUndefined();
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM post_search WHERE post_id = ?').get(p.id)).toEqual({ n: 0 });
  });

  it('short (Chinese) search terms fall back to LIKE and respect visibility', async () => {
    await savePost(null, base({ title: '公开的注意力', visibility: 'public' }), 'publish');
    await savePost(null, base({ title: '私密的注意力', visibility: 'private' }), 'publish');
    const hits = searchPublicPosts('注意');
    expect(hits.map((h) => h.title)).toEqual(['公开的注意力']);
  });

  it('private stats are not computed for visitors unless whitelisted', () => {
    const kinds = publicStats().map((s) => s.kind);
    expect(kinds).toEqual(['site-days']);
  });
});
