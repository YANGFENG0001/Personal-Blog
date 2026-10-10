import { getDb, newId, now } from '../db';
import { conflict, notFound } from '../errors';
import { categoryInput, siteInput } from '../validation';
import type { z } from 'zod';

export interface Site {
  id: string;
  slug: string;
  name: string;
  enName: string;
  description: string;
  icon: string;
  accent: string | null;
  visibility: 'public' | 'private';
  sort: number;
}

export interface Category {
  id: string;
  siteId: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  layout: 'list' | 'cards' | 'compact';
  sort: number;
}

const SITE_COLS = `id, slug, name, en_name AS enName, description, icon, accent, visibility, sort`;
const CAT_COLS = `id, site_id AS siteId, slug, name, description, visibility, layout, sort`;

export function listSites(opts: { publicOnly?: boolean } = {}): Site[] {
  const where = opts.publicOnly ? `WHERE visibility = 'public'` : '';
  return getDb().prepare(`SELECT ${SITE_COLS} FROM sites ${where} ORDER BY sort, created_at`).all() as Site[];
}

export function getSite(id: string): Site | undefined {
  return getDb().prepare(`SELECT ${SITE_COLS} FROM sites WHERE id = ?`).get(id) as Site | undefined;
}

export function getSiteBySlug(slug: string, opts: { publicOnly?: boolean } = {}): Site | undefined {
  const extra = opts.publicOnly ? `AND visibility = 'public'` : '';
  return getDb().prepare(`SELECT ${SITE_COLS} FROM sites WHERE slug = ? ${extra}`).get(slug) as Site | undefined;
}

export function listCategories(siteId?: string, opts: { publicOnly?: boolean } = {}): Category[] {
  const conds: string[] = [];
  const args: string[] = [];
  if (siteId) {
    conds.push('site_id = ?');
    args.push(siteId);
  }
  if (opts.publicOnly) conds.push(`visibility = 'public'`);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return getDb().prepare(`SELECT ${CAT_COLS} FROM categories ${where} ORDER BY sort, created_at`).all(...args) as Category[];
}

export function getCategory(id: string): Category | undefined {
  return getDb().prepare(`SELECT ${CAT_COLS} FROM categories WHERE id = ?`).get(id) as Category | undefined;
}

export function getCategoryBySlug(siteId: string, slug: string, opts: { publicOnly?: boolean } = {}) {
  const extra = opts.publicOnly ? `AND visibility = 'public'` : '';
  return getDb()
    .prepare(`SELECT ${CAT_COLS} FROM categories WHERE site_id = ? AND slug = ? ${extra}`)
    .get(siteId, slug) as Category | undefined;
}

/** Public site tree: only public sites with their public categories. */
export function publicSiteTree(): (Site & { categories: Category[] })[] {
  const cats = listCategories(undefined, { publicOnly: true });
  return listSites({ publicOnly: true }).map((s) => ({ ...s, categories: cats.filter((c) => c.siteId === s.id) }));
}

export function siteTree(): (Site & { categories: Category[] })[] {
  const cats = listCategories();
  return listSites().map((s) => ({ ...s, categories: cats.filter((c) => c.siteId === s.id) }));
}

function nextSort(table: 'sites' | 'categories', where = '', ...args: string[]): number {
  const row = getDb().prepare(`SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM ${table} ${where}`).get(...args) as { n: number };
  return row.n;
}

export function createSite(raw: unknown): Site {
  const input = siteInput.parse(raw);
  const db = getDb();
  if (getSiteBySlug(input.slug)) throw conflict('该 URL 名称已被其他分站使用');
  const id = newId();
  const ts = now();
  db.prepare(
    `INSERT INTO sites (id, slug, name, en_name, description, icon, accent, visibility, sort, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.slug, input.name, input.enName, input.description, input.icon, input.accent, input.visibility, nextSort('sites'), ts, ts);
  return getSite(id)!;
}

export function updateSite(id: string, raw: unknown): Site {
  const input = siteInput.parse(raw);
  if (!getSite(id)) throw notFound('分站');
  const other = getSiteBySlug(input.slug);
  if (other && other.id !== id) throw conflict('该 URL 名称已被其他分站使用');
  getDb()
    .prepare(
      `UPDATE sites SET slug = ?, name = ?, en_name = ?, description = ?, icon = ?, accent = ?, visibility = ?, updated_at = ? WHERE id = ?`,
    )
    .run(input.slug, input.name, input.enName, input.description, input.icon, input.accent, input.visibility, now(), id);
  return getSite(id)!;
}

/** Deleting a site is refused while it still has categories (which may hold posts). */
export function deleteSite(id: string): void {
  if (!getSite(id)) throw notFound('分站');
  const n = (getDb().prepare('SELECT COUNT(*) AS n FROM categories WHERE site_id = ?').get(id) as { n: number }).n;
  if (n > 0) throw conflict(`该分站下还有 ${n} 个栏目，请先删除或迁移栏目`);
  getDb().prepare('DELETE FROM sites WHERE id = ?').run(id);
}

export function createCategory(raw: unknown): Category {
  const input = categoryInput.parse(raw);
  if (!getSite(input.siteId)) throw notFound('分站');
  if (getCategoryBySlug(input.siteId, input.slug)) throw conflict('该分站下已有相同 URL 名称的栏目');
  const id = newId();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO categories (id, site_id, slug, name, description, visibility, layout, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.siteId, input.slug, input.name, input.description, input.visibility, input.layout,
      nextSort('categories', 'WHERE site_id = ?', input.siteId), ts, ts);
  return getCategory(id)!;
}

export function updateCategory(id: string, raw: unknown): Category {
  const input = categoryInput.parse(raw);
  const cur = getCategory(id);
  if (!cur) throw notFound('栏目');
  if (!getSite(input.siteId)) throw notFound('分站');
  const other = getCategoryBySlug(input.siteId, input.slug);
  if (other && other.id !== id) throw conflict('该分站下已有相同 URL 名称的栏目');
  getDb()
    .prepare(
      `UPDATE categories SET site_id = ?, slug = ?, name = ?, description = ?, visibility = ?, layout = ?, updated_at = ? WHERE id = ?`,
    )
    .run(input.siteId, input.slug, input.name, input.description, input.visibility, input.layout, now(), id);
  return getCategory(id)!;
}

/**
 * Delete a category. If it still holds posts, they must be moved first:
 * pass `moveTo` to migrate them into another category in the same call.
 */
export function deleteCategory(id: string, moveTo?: string | null): void {
  const db = getDb();
  if (!getCategory(id)) throw notFound('栏目');
  const n = (db.prepare('SELECT COUNT(*) AS n FROM posts WHERE category_id = ?').get(id) as { n: number }).n;
  if (n > 0) {
    if (!moveTo) throw conflict(`该栏目下还有 ${n} 篇文章，请选择迁移目标栏目`);
    if (moveTo === id || !getCategory(moveTo)) throw notFound('目标栏目');
  }
  db.transaction(() => {
    if (n > 0) db.prepare('UPDATE posts SET category_id = ?, updated_at = ? WHERE category_id = ?').run(moveTo, now(), id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  })();
}

export function reorder(table: 'sites' | 'categories' | 'task_boards' | 'tasks' | 'site_modules' | 'templates' | 'quotes' | 'stat_defs' | 'knowledge_nodes', ids: string[]): void {
  const db = getDb();
  const stmt = db.prepare(`UPDATE ${table} SET sort = ? WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

export type SiteInput = z.infer<typeof siteInput>;
