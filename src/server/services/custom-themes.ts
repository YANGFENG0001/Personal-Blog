import { getDb, newId, now } from '../db';
import { badRequest, notFound } from '../errors';
import { checkThemeCss, themeSchema, type CustomTheme, type StoredTheme } from '../../lib/custom-theme';

const MAX_THEMES = 40;
const KEEP_VERSIONS = 10;

interface Row {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

function toStored(r: Row): StoredTheme | null {
  try {
    return { ...themeSchema.parse(JSON.parse(r.data)), id: r.id, createdAt: r.created_at, updatedAt: r.updated_at };
  } catch {
    return null;
  }
}

/** Validate a theme and its CSS. Throws a readable 400 when anything is wrong. */
export function validateTheme(raw: unknown): { theme: CustomTheme; warnings: string[] } {
  const parsed = themeSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '文件'}：${i.message}`).join('；');
    throw badRequest(`主题文件格式不正确：${first}`);
  }
  const theme = parsed.data;
  const warnings: string[] = [];
  if (theme.css.trim()) {
    const c = checkThemeCss(theme.css);
    if (!c.ok) throw badRequest(`自定义 CSS 未通过检查：${c.errors.join('；')}`);
    warnings.push(...c.warnings);
  }
  return { theme, warnings };
}

export function listThemes(): StoredTheme[] {
  return (getDb().prepare('SELECT id, data, created_at, updated_at FROM custom_themes ORDER BY created_at').all() as Row[]).flatMap((r) => {
    const t = toStored(r);
    return t ? [t] : [];
  });
}

export function getTheme(id: string): StoredTheme | null {
  const r = getDb().prepare('SELECT id, data, created_at, updated_at FROM custom_themes WHERE id = ?').get(id) as Row | undefined;
  return r ? toStored(r) : null;
}

export function createTheme(raw: unknown): { theme: StoredTheme; warnings: string[] } {
  const n = (getDb().prepare('SELECT COUNT(*) AS n FROM custom_themes').get() as { n: number }).n;
  if (n >= MAX_THEMES) throw badRequest(`最多保存 ${MAX_THEMES} 个自定义主题`);
  const { theme, warnings } = validateTheme(raw);
  const id = newId();
  const ts = now();
  getDb().prepare('INSERT INTO custom_themes (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, theme.name, JSON.stringify(theme), ts, ts);
  return { theme: getTheme(id)!, warnings };
}

/** Save a new version; the previous one is kept for rollback (last 10). */
export function updateTheme(id: string, raw: unknown): { theme: StoredTheme; warnings: string[] } {
  const cur = getDb().prepare('SELECT data FROM custom_themes WHERE id = ?').get(id) as { data: string } | undefined;
  if (!cur) throw notFound('主题');
  const { theme, warnings } = validateTheme(raw);
  const db = getDb();
  db.transaction(() => {
    db.prepare('INSERT INTO custom_theme_versions (theme_id, data, created_at) VALUES (?, ?, ?)').run(id, cur.data, now());
    db.prepare(
      `DELETE FROM custom_theme_versions WHERE theme_id = ? AND id NOT IN (SELECT id FROM custom_theme_versions WHERE theme_id = ? ORDER BY id DESC LIMIT ${KEEP_VERSIONS})`,
    ).run(id, id);
    db.prepare('UPDATE custom_themes SET name = ?, data = ?, updated_at = ? WHERE id = ?').run(theme.name, JSON.stringify(theme), now(), id);
  })();
  return { theme: getTheme(id)!, warnings };
}

export function listVersions(id: string): { id: number; name: string; createdAt: string }[] {
  if (!getTheme(id)) throw notFound('主题');
  return (getDb().prepare('SELECT id, data, created_at FROM custom_theme_versions WHERE theme_id = ? ORDER BY id DESC').all(id) as { id: number; data: string; created_at: string }[]).map((v) => {
    let name = '';
    try {
      name = JSON.parse(v.data).name ?? '';
    } catch { /* ignore */ }
    return { id: v.id, name, createdAt: v.created_at };
  });
}

export function rollbackTheme(id: string, versionId: number): StoredTheme {
  const v = getDb().prepare('SELECT data FROM custom_theme_versions WHERE id = ? AND theme_id = ?').get(versionId, id) as { data: string } | undefined;
  if (!v) throw notFound('历史版本');
  return updateTheme(id, JSON.parse(v.data)).theme;
}

export function deleteTheme(id: string): void {
  if (!getTheme(id)) throw notFound('主题');
  getDb().prepare('DELETE FROM custom_themes WHERE id = ?').run(id);
}

/** The portable file: the theme as JSON without server ids. */
export function exportTheme(id: string): CustomTheme {
  const t = getTheme(id);
  if (!t) throw notFound('主题');
  const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = t;
  return rest;
}
