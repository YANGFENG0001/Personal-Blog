import { getDb, newId } from '../db';
import { notFound } from '../errors';
import { moduleInput, quoteInput, templateInput } from '../validation';
import { conflict } from '../errors';

/* ---------------- Module registry ---------------- */

export type Zone = 'public-home' | 'public-sidebar' | 'public-article' | 'owner-dashboard' | 'owner-editor';

export interface SiteModule {
  id: string;
  type: string;
  zone: Zone;
  name: string;
  enabled: boolean;
  visibleTo: 'public' | 'owner';
  sort: number;
  settings: Record<string, unknown>;
}

export function listModules(zone?: Zone): SiteModule[] {
  const where = zone ? 'WHERE zone = ?' : '';
  return (
    getDb()
      .prepare(`SELECT id, type, zone, name, enabled, visible_to AS visibleTo, sort, settings FROM site_modules ${where} ORDER BY zone, sort`)
      .all(...(zone ? [zone] : [])) as Record<string, unknown>[]
  ).map((r) => ({ ...(r as unknown as SiteModule), enabled: !!r.enabled, settings: JSON.parse(String(r.settings)) }));
}

/** Enabled modules for a zone; public zones only return publicly visible ones. */
export function activeModules(zone: Zone): SiteModule[] {
  return listModules(zone).filter((m) => m.enabled && (zone.startsWith('owner') || m.visibleTo === 'public'));
}

export function isModuleActive(zone: Zone, type: string): boolean {
  return activeModules(zone).some((m) => m.type === type);
}

export function updateModule(id: string, raw: unknown): void {
  const input = moduleInput.parse(raw);
  const r = getDb()
    .prepare('UPDATE site_modules SET name = ?, enabled = ?, visible_to = ?, settings = ? WHERE id = ?')
    .run(input.name, input.enabled ? 1 : 0, input.visibleTo, JSON.stringify(input.settings), id);
  if (r.changes === 0) throw notFound('模块');
}

/* ---------------- Templates ---------------- */

export interface Template {
  id: string;
  name: string;
  description: string;
  bodyMd: string;
  reflectionMd: string;
  defaultProgress: string | null;
  progressOptions: string[];
  sort: number;
}

export function listTemplates(): Template[] {
  return (
    getDb()
      .prepare(
        `SELECT id, name, description, body_md AS bodyMd, reflection_md AS reflectionMd, default_progress AS defaultProgress,
          progress_options AS progressOptions, sort FROM templates ORDER BY sort`,
      )
      .all() as Record<string, unknown>[]
  ).map((r) => ({ ...(r as unknown as Template), progressOptions: JSON.parse(String(r.progressOptions)) }));
}

export function saveTemplate(raw: unknown, isNew: boolean): void {
  const t = templateInput.parse(raw);
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM templates WHERE id = ?').get(t.id);
  if (isNew && exists) throw conflict('模板 ID 已存在');
  if (!isNew && !exists) throw notFound('模板');
  if (isNew) {
    const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM templates').get() as { n: number }).n;
    db.prepare(
      `INSERT INTO templates (id, name, description, body_md, reflection_md, default_progress, progress_options, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(t.id, t.name, t.description, t.bodyMd, t.reflectionMd, t.defaultProgress, JSON.stringify(t.progressOptions), sort);
  } else {
    db.prepare(
      `UPDATE templates SET name = ?, description = ?, body_md = ?, reflection_md = ?, default_progress = ?, progress_options = ? WHERE id = ?`,
    ).run(t.name, t.description, t.bodyMd, t.reflectionMd, t.defaultProgress, JSON.stringify(t.progressOptions), t.id);
  }
}

export function deleteTemplate(id: string): void {
  const r = getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
  if (r.changes === 0) throw notFound('模板');
}

/* ---------------- Progress vocabulary ---------------- */

export function listProgressOptions(): { id: string; label: string }[] {
  return getDb().prepare('SELECT id, label FROM progress_options ORDER BY sort').all() as { id: string; label: string }[];
}

export function setProgressOptions(labels: string[]): void {
  const db = getDb();
  const clean = [...new Set(labels.map((l) => l.trim()).filter(Boolean))].slice(0, 40);
  db.transaction(() => {
    db.prepare('DELETE FROM progress_options').run();
    const ins = db.prepare('INSERT INTO progress_options (id, label, sort) VALUES (?, ?, ?)');
    clean.forEach((l, i) => ins.run(newId(), l, i));
  })();
}

/* ---------------- Quotes ---------------- */

export interface Quote {
  id: string;
  text: string;
  author: string;
  source: string;
  followUp: string;
  category: string;
  enabled: boolean;
  sort: number;
}

export function listQuotes(opts: { enabledOnly?: boolean } = {}): Quote[] {
  const where = opts.enabledOnly ? 'WHERE enabled = 1' : '';
  return (
    getDb()
      .prepare(`SELECT id, text, author, source, follow_up AS followUp, category, enabled, sort FROM quotes ${where} ORDER BY sort`)
      .all() as Record<string, unknown>[]
  ).map((r) => ({ ...(r as unknown as Quote), enabled: !!r.enabled }));
}

export function createQuote(raw: unknown): Quote {
  const q = quoteInput.parse(raw);
  const db = getDb();
  const id = newId();
  const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM quotes').get() as { n: number }).n;
  db.prepare('INSERT INTO quotes (id, text, author, source, follow_up, category, enabled, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, q.text, q.author, q.source, q.followUp, q.category, q.enabled ? 1 : 0, sort,
  );
  return listQuotes().find((x) => x.id === id)!;
}

export function updateQuote(id: string, raw: unknown): void {
  const q = quoteInput.parse(raw);
  const r = getDb()
    .prepare('UPDATE quotes SET text = ?, author = ?, source = ?, follow_up = ?, category = ?, enabled = ? WHERE id = ?')
    .run(q.text, q.author, q.source, q.followUp, q.category, q.enabled ? 1 : 0, id);
  if (r.changes === 0) throw notFound('语录');
}

export function deleteQuote(id: string): void {
  const r = getDb().prepare('DELETE FROM quotes WHERE id = ?').run(id);
  if (r.changes === 0) throw notFound('语录');
}
