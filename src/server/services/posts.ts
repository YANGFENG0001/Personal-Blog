import { getDb, newId, now } from '../db';
import { badRequest, conflict, notFound } from '../errors';
import { postInput } from '../validation';
import { PUBLIC_POST_SQL, POST_JOIN_SQL, hiddenReason } from '../visibility';
import { RENDERER_VERSION, renderMarkdown, type TocItem } from '../../lib/markdown/render';
import { getCategory } from './sites';
import { recordActivity } from './activity';

export type PostStatus = 'draft' | 'published' | 'archived';

export interface PostLink {
  id: string;
  label: string;
  url: string;
  kind: string;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: PostStatus;
  visibility: 'public' | 'private';
  featured: boolean;
  templateId: string | null;
  progress: string | null;
  progressPublic: boolean;
  readingMinutes: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryVisibility: string;
  siteId: string;
  siteSlug: string;
  siteName: string;
  siteVisibility: string;
  tags: string[];
}

export interface PostFull extends PostSummary {
  bodyMd: string;
  bodyHtml: string;
  toc: TocItem[];
  reflectionMd: string;
  reflectionHtml: string;
  reflectionPublic: boolean;
  links: PostLink[];
}

const SUMMARY_COLS = `
  p.id, p.slug, p.title, p.summary, p.status, p.visibility, p.featured, p.template_id AS templateId,
  p.progress, p.progress_public AS progressPublic, p.reading_minutes AS readingMinutes, p.cover_url AS coverUrl,
  p.created_at AS createdAt, p.updated_at AS updatedAt, p.published_at AS publishedAt,
  c.id AS categoryId, c.slug AS categorySlug, c.name AS categoryName, c.visibility AS categoryVisibility,
  s.id AS siteId, s.slug AS siteSlug, s.name AS siteName, s.visibility AS siteVisibility,
  (SELECT group_concat(tag, char(31)) FROM post_tags t WHERE t.post_id = p.id) AS tagList
`;

type Row = Record<string, unknown>;

function toSummary(r: Row): PostSummary {
  const { tagList, featured, progressPublic, ...rest } = r;
  return {
    ...(rest as unknown as PostSummary),
    featured: !!featured,
    progressPublic: !!progressPublic,
    tags: tagList ? String(tagList).split('\x1f').sort() : [],
  };
}

function loadLinks(postId: string): PostLink[] {
  return getDb()
    .prepare('SELECT id, label, url, kind FROM post_links WHERE post_id = ? ORDER BY sort')
    .all(postId) as PostLink[];
}

function toFull(r: Row): PostFull {
  const base = toSummary(r);
  return {
    ...base,
    bodyMd: String(r.bodyMd),
    bodyHtml: String(r.bodyHtml),
    toc: JSON.parse(String(r.toc || '[]')),
    reflectionMd: String(r.reflectionMd),
    reflectionHtml: String(r.reflectionHtml),
    reflectionPublic: !!r.reflectionPublic,
    links: loadLinks(base.id),
  };
}

const FULL_COLS = `${SUMMARY_COLS}, p.body_md AS bodyMd, p.body_html AS bodyHtml, p.toc,
  p.reflection_md AS reflectionMd, p.reflection_html AS reflectionHtml, p.reflection_public AS reflectionPublic`;

/* ------------------------------------------------------------------ */
/* Public queries — ALL go through PUBLIC_POST_SQL                    */
/* ------------------------------------------------------------------ */

export interface PublicListOptions {
  siteId?: string;
  categoryId?: string;
  tag?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export function listPublicPosts(o: PublicListOptions = {}): { items: PostSummary[]; total: number } {
  const conds = [PUBLIC_POST_SQL];
  const params: Record<string, unknown> = { now: now() };
  if (o.siteId) {
    conds.push('s.id = @siteId');
    params.siteId = o.siteId;
  }
  if (o.categoryId) {
    conds.push('c.id = @categoryId');
    params.categoryId = o.categoryId;
  }
  if (o.tag) {
    conds.push('EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = p.id AND t.tag = @tag)');
    params.tag = o.tag;
  }
  if (o.featured) conds.push('p.featured = 1');
  const where = conds.join(' AND ');
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${POST_JOIN_SQL} WHERE ${where}`).get(params) as { n: number }).n;
  const items = db
    .prepare(
      `SELECT ${SUMMARY_COLS} FROM ${POST_JOIN_SQL} WHERE ${where}
       ORDER BY p.published_at DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: o.limit ?? 20, offset: o.offset ?? 0 }) as Row[];
  return { items: items.map(toSummary), total };
}

export function getPublicPost(siteSlug: string, categorySlug: string, slug: string): PostFull | undefined {
  const r = getDb()
    .prepare(
      `SELECT ${FULL_COLS} FROM ${POST_JOIN_SQL}
       WHERE ${PUBLIC_POST_SQL} AND s.slug = @siteSlug AND c.slug = @categorySlug AND p.slug = @slug`,
    )
    .get({ now: now(), siteSlug, categorySlug, slug }) as Row | undefined;
  return r ? redactForPublic(toFull(r)) : undefined;
}

/** Look up a public post by slug only (used for canonical redirects and old slugs). */
export function findPublicPostPath(slug: string): string | undefined {
  const db = getDb();
  const redirect = db.prepare('SELECT post_id AS id FROM post_redirects WHERE old_slug = ?').get(slug) as
    | { id: string }
    | undefined;
  const r = db
    .prepare(
      `SELECT s.slug AS s, c.slug AS c, p.slug AS p FROM ${POST_JOIN_SQL}
       WHERE ${PUBLIC_POST_SQL} AND ${redirect ? 'p.id = @id' : 'p.slug = @slug'}`,
    )
    .get({ now: now(), slug, id: redirect?.id }) as { s: string; c: string; p: string } | undefined;
  return r ? `/${r.s}/${r.c}/${r.p}` : undefined;
}

/** Strip owner-only fields so they never reach public HTML. */
function redactForPublic(p: PostFull): PostFull {
  return {
    ...p,
    bodyMd: '',
    reflectionMd: '',
    reflectionHtml: p.reflectionPublic ? p.reflectionHtml : '',
    progress: p.progressPublic ? p.progress : null,
  };
}

export function listPublicTags(): { tag: string; count: number }[] {
  return getDb()
    .prepare(
      `SELECT t.tag, COUNT(*) AS count FROM ${POST_JOIN_SQL} JOIN post_tags t ON t.post_id = p.id
       WHERE ${PUBLIC_POST_SQL} GROUP BY t.tag ORDER BY count DESC, t.tag`,
    )
    .all({ now: now() }) as { tag: string; count: number }[];
}

export function listPublicArchive(): PostSummary[] {
  return getDb()
    .prepare(`SELECT ${SUMMARY_COLS} FROM ${POST_JOIN_SQL} WHERE ${PUBLIC_POST_SQL} ORDER BY p.published_at DESC`)
    .all({ now: now() })
    .map((r) => toSummary(r as Row));
}

/** Escape user input for FTS5: each term quoted, so operators are literal. */
export function ftsQuery(q: string): string | null {
  const terms = q
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .slice(0, 8)
    .map((t) => `"${t.replace(/"/g, '""')}"`);
  return terms.length ? terms.join(' ') : null;
}

function searchWhere(q: string): { sql: string; params: Record<string, unknown> } {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  // trigram FTS needs >= 3 chars per term; fall back to LIKE for short terms (common in Chinese).
  if (terms.length && terms.every((t) => [...t].length >= 3)) {
    return {
      sql: `p.id IN (SELECT post_id FROM post_search WHERE post_search MATCH @fts)`,
      params: { fts: ftsQuery(q) },
    };
  }
  const params: Record<string, unknown> = {};
  const parts = terms.map((t, i) => {
    params[`t${i}`] = `%${t.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    return `(p.title LIKE @t${i} ESCAPE '\\' OR p.summary LIKE @t${i} ESCAPE '\\' OR p.body_md LIKE @t${i} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = p.id AND t.tag LIKE @t${i} ESCAPE '\\'))`;
  });
  return { sql: parts.join(' AND ') || '0', params };
}

export function searchPublicPosts(q: string, limit = 30): PostSummary[] {
  if (!q.trim()) return [];
  const w = searchWhere(q);
  return getDb()
    .prepare(
      `SELECT ${SUMMARY_COLS} FROM ${POST_JOIN_SQL}
       WHERE ${PUBLIC_POST_SQL} AND ${w.sql} ORDER BY p.published_at DESC LIMIT @limit`,
    )
    .all({ ...w.params, now: now(), limit })
    .map((r) => toSummary(r as Row));
}

/* ------------------------------------------------------------------ */
/* Owner queries                                                      */
/* ------------------------------------------------------------------ */

export interface OwnerListOptions {
  q?: string;
  siteId?: string;
  categoryId?: string;
  tag?: string;
  status?: PostStatus | 'public' | 'hidden';
  templateId?: string;
  limit?: number;
  offset?: number;
}

export function listPosts(o: OwnerListOptions = {}): { items: (PostSummary & { hiddenReason: string | null })[]; total: number } {
  const conds = ['1 = 1'];
  const params: Record<string, unknown> = { now: now() };
  if (o.siteId) {
    conds.push('s.id = @siteId');
    params.siteId = o.siteId;
  }
  if (o.categoryId) {
    conds.push('c.id = @categoryId');
    params.categoryId = o.categoryId;
  }
  if (o.tag) {
    conds.push('EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = p.id AND t.tag = @tag)');
    params.tag = o.tag;
  }
  if (o.templateId) {
    conds.push('p.template_id = @templateId');
    params.templateId = o.templateId;
  }
  if (o.status === 'public') conds.push(`(${PUBLIC_POST_SQL})`);
  else if (o.status === 'hidden') conds.push(`NOT (${PUBLIC_POST_SQL})`);
  else if (o.status) {
    conds.push('p.status = @status');
    params.status = o.status;
  }
  if (o.q?.trim()) {
    const w = searchWhere(o.q);
    conds.push(w.sql);
    Object.assign(params, w.params);
  }
  const where = conds.join(' AND ');
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${POST_JOIN_SQL} WHERE ${where}`).get(params) as { n: number }).n;
  const items = db
    .prepare(`SELECT ${SUMMARY_COLS} FROM ${POST_JOIN_SQL} WHERE ${where} ORDER BY p.updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: o.limit ?? 50, offset: o.offset ?? 0 })
    .map((r) => {
      const s = toSummary(r as Row);
      return { ...s, hiddenReason: hiddenReason(s) };
    });
  return { items, total };
}

export function getPost(id: string): PostFull | undefined {
  const r = getDb().prepare(`SELECT ${FULL_COLS} FROM ${POST_JOIN_SQL} WHERE p.id = ?`).get(id) as Row | undefined;
  return r ? toFull(r) : undefined;
}

export function listAllTags(): string[] {
  return (getDb().prepare('SELECT DISTINCT tag FROM post_tags ORDER BY tag').all() as { tag: string }[]).map((r) => r.tag);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return ascii.length >= 3 ? ascii : `post-${newId().slice(0, 8)}`;
}

function uniqueSlug(base: string, exceptId?: string): string {
  const db = getDb();
  const taken = (s: string) => {
    const row = db.prepare('SELECT id FROM posts WHERE slug = ?').get(s) as { id: string } | undefined;
    const redir = db.prepare('SELECT post_id FROM post_redirects WHERE old_slug = ?').get(s) as { post_id: string } | undefined;
    return (row && row.id !== exceptId) || (redir && redir.post_id !== exceptId);
  };
  let s = base;
  for (let i = 2; taken(s); i++) s = `${base}-${i}`;
  return s;
}

function syncSearch(postId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM post_search WHERE post_id = ?').run(postId);
  const p = db.prepare('SELECT title, summary, body_md FROM posts WHERE id = ?').get(postId) as
    | { title: string; summary: string; body_md: string }
    | undefined;
  if (!p) return;
  const tags = (db.prepare('SELECT tag FROM post_tags WHERE post_id = ?').all(postId) as { tag: string }[]).map((t) => t.tag);
  db.prepare('INSERT INTO post_search (post_id, title, summary, body, tags) VALUES (?, ?, ?, ?, ?)').run(
    postId, p.title, p.summary, p.body_md, tags.join(' '),
  );
}

function writeChildren(postId: string, tags: string[], links: { label: string; url: string; kind: string }[]) {
  const db = getDb();
  db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  const insTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)');
  for (const t of tags) insTag.run(postId, t);
  db.prepare('DELETE FROM post_links WHERE post_id = ?').run(postId);
  const insLink = db.prepare('INSERT INTO post_links (id, post_id, label, url, kind, sort) VALUES (?, ?, ?, ?, ?, ?)');
  links.forEach((l, i) => insLink.run(newId(), postId, l.label, l.url, l.kind, i));
}

export type SaveAction = 'save' | 'publish' | 'unpublish' | 'archive';

/**
 * Create or update a post. `action` decides the status transition:
 *  - save:      keep current status (new posts start as draft)
 *  - publish:   status = published; first publish sets published_at
 *  - unpublish: status = draft (withdraws it from the public site)
 *  - archive:   status = archived
 */
export async function savePost(id: string | null, raw: unknown, action: SaveAction = 'save'): Promise<PostFull> {
  const input = postInput.parse(raw);
  const db = getDb();
  const cat = getCategory(input.categoryId);
  if (!cat) throw badRequest('所选栏目不存在');

  const existing = id ? getPost(id) : undefined;
  if (id && !existing) throw notFound('文章');

  let slug: string;
  if (input.slug) {
    slug = input.slug;
    const clash = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, id ?? '');
    if (clash) throw conflict('URL 名称已被其他文章使用');
  } else {
    slug = existing ? existing.slug : uniqueSlug(slugify(input.title));
  }

  const [body, reflection] = await Promise.all([renderMarkdown(input.bodyMd), renderMarkdown(input.reflectionMd)]);

  const ts = now();
  let status: PostStatus = existing?.status ?? 'draft';
  let publishedAt = existing?.publishedAt ?? null;
  if (action === 'publish') {
    status = 'published';
    publishedAt = input.publishedAt ?? publishedAt ?? ts;
  } else if (action === 'unpublish') status = 'draft';
  else if (action === 'archive') status = 'archived';
  if (input.publishedAt !== undefined && input.publishedAt !== null && status === 'published') publishedAt = input.publishedAt;
  if (publishedAt) publishedAt = new Date(publishedAt).toISOString();

  const postId = existing?.id ?? newId();
  db.transaction(() => {
    const values = {
      id: postId, slug, title: input.title, summary: input.summary, categoryId: input.categoryId, status,
      visibility: input.visibility, templateId: input.templateId, progress: input.progress,
      progressPublic: input.progressPublic ? 1 : 0, bodyMd: input.bodyMd, bodyHtml: body.html,
      toc: JSON.stringify(body.toc), readingMinutes: body.readingMinutes, reflectionMd: input.reflectionMd,
      reflectionHtml: reflection.html, reflectionPublic: input.reflectionPublic ? 1 : 0, coverUrl: input.coverUrl,
      featured: input.featured ? 1 : 0, ts, publishedAt,
    };
    if (existing) {
      if (existing.slug !== slug) {
        // Keep the old URL working.
        db.prepare('INSERT OR REPLACE INTO post_redirects (old_slug, post_id) VALUES (?, ?)').run(existing.slug, postId);
        db.prepare('DELETE FROM post_redirects WHERE old_slug = ?').run(slug);
      }
      db.prepare(
        `UPDATE posts SET slug=@slug, title=@title, summary=@summary, category_id=@categoryId, status=@status,
          visibility=@visibility, template_id=@templateId, progress=@progress, progress_public=@progressPublic,
          body_md=@bodyMd, body_html=@bodyHtml, toc=@toc, reading_minutes=@readingMinutes,
          reflection_md=@reflectionMd, reflection_html=@reflectionHtml, reflection_public=@reflectionPublic,
          cover_url=@coverUrl, featured=@featured, updated_at=@ts, published_at=@publishedAt
         WHERE id=@id`,
      ).run(values);
    } else {
      db.prepare(
        `INSERT INTO posts (id, slug, title, summary, category_id, status, visibility, template_id, progress, progress_public,
          body_md, body_html, toc, reading_minutes, reflection_md, reflection_html, reflection_public, cover_url, featured,
          created_at, updated_at, published_at)
         VALUES (@id, @slug, @title, @summary, @categoryId, @status, @visibility, @templateId, @progress, @progressPublic,
          @bodyMd, @bodyHtml, @toc, @readingMinutes, @reflectionMd, @reflectionHtml, @reflectionPublic, @coverUrl, @featured,
          @ts, @ts, @publishedAt)`,
      ).run(values);
    }
    writeChildren(postId, [...new Set(input.tags)], input.links);
    syncSearch(postId);
    recordActivity('post-save');
  })();
  return getPost(postId)!;
}

export function deletePost(id: string): void {
  const db = getDb();
  if (!getPost(id)) throw notFound('文章');
  db.transaction(() => {
    db.prepare('DELETE FROM post_search WHERE post_id = ?').run(id);
    db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  })();
}

/** Rebuild cached HTML for every post (after a renderer upgrade). */
export async function rerenderAll(): Promise<number> {
  return rerender('SELECT id, body_md, reflection_md FROM posts');
}

/**
 * Make cached HTML current: re-render everything once after a renderer
 * upgrade (tracked in settings), otherwise only posts missing HTML.
 */
export async function ensureRendered(): Promise<number> {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'rendererVersion'`).get() as { value: string } | undefined;
  if (Number(row?.value ?? 0) !== RENDERER_VERSION) {
    const n = await rerenderAll();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('rendererVersion', ?)`).run(String(RENDERER_VERSION));
    return n;
  }
  return rerenderMissing();
}

/** Render posts whose HTML cache is missing (e.g. seeded or imported directly into the DB). */
export function rerenderMissing(): Promise<number> {
  return rerender(`SELECT id, body_md, reflection_md FROM posts WHERE (body_html = '' AND body_md != '') OR (reflection_html = '' AND reflection_md != '')`);
}

async function rerender(sql: string): Promise<number> {
  const db = getDb();
  const rows = db.prepare(sql).all() as { id: string; body_md: string; reflection_md: string }[];
  for (const r of rows) {
    const [b, f] = await Promise.all([renderMarkdown(r.body_md), renderMarkdown(r.reflection_md)]);
    db.prepare('UPDATE posts SET body_html = ?, toc = ?, reading_minutes = ?, reflection_html = ? WHERE id = ?').run(
      b.html, JSON.stringify(b.toc), b.readingMinutes, f.html, r.id,
    );
    syncSearch(r.id);
  }
  return rows.length;
}
