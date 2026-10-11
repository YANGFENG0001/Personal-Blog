import { getDb, now } from '../db';
import { notFound } from '../errors';
import { statDefInput } from '../validation';
import { PUBLIC_POST_SQL, POST_JOIN_SQL } from '../visibility';
import { currentStreak, daysSince, distinctDays, longestStreak } from '../../lib/stats';
import { activityDays, dayKey, heartbeatDays } from './activity';
import { getSetting } from './settings';

export type StatKind = 'site-days' | 'uptime-streak' | 'publish-days' | 'publish-streak' | 'learning-streak' | 'post-count';

export interface StatDef {
  id: string;
  kind: StatKind;
  label: string;
  description: string;
  enabled: boolean;
  public: boolean;
  siteIds: string[] | null;
  startDate: string | null;
  sort: number;
}

export interface StatValue extends StatDef {
  value: number;
  unit: string;
}

export function listStatDefs(): StatDef[] {
  return (
    getDb()
      .prepare(
        `SELECT id, kind, label, description, enabled, public, site_ids AS siteIds, start_date AS startDate, sort FROM stat_defs ORDER BY sort`,
      )
      .all() as Record<string, unknown>[]
  ).map((r) => ({
    ...(r as unknown as StatDef),
    enabled: !!r.enabled,
    public: !!r.public,
    siteIds: r.siteIds ? JSON.parse(String(r.siteIds)) : null,
  }));
}

export function updateStatDef(id: string, raw: unknown): void {
  const input = statDefInput.parse(raw);
  const r = getDb()
    .prepare('UPDATE stat_defs SET label = ?, enabled = ?, public = ?, site_ids = ?, start_date = ? WHERE id = ?')
    .run(input.label, input.enabled ? 1 : 0, input.public ? 1 : 0, input.siteIds ? JSON.stringify(input.siteIds) : null, input.startDate, id);
  if (r.changes === 0) throw notFound('统计项');
}

/** Days on which at least one currently-public post was first published. */
function publicPublishDays(): string[] {
  const rows = getDb()
    .prepare(`SELECT p.published_at AS at FROM ${POST_JOIN_SQL} WHERE ${PUBLIC_POST_SQL}`)
    .all({ now: now() }) as { at: string }[];
  return rows.map((r) => dayKey(new Date(r.at)));
}

function publicPostCount(): number {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM ${POST_JOIN_SQL} WHERE ${PUBLIC_POST_SQL}`).get({ now: now() }) as { n: number }).n;
}

export function computeStat(def: Pick<StatDef, 'kind' | 'startDate'>, today = dayKey()): number {
  switch (def.kind) {
    case 'site-days':
      return daysSince(def.startDate || getSetting('site').launchDate, today);
    case 'uptime-streak':
      return currentStreak(heartbeatDays(), today, false);
    case 'publish-days':
      return distinctDays(publicPublishDays());
    case 'publish-streak':
      return currentStreak(publicPublishDays(), today);
    case 'learning-streak':
      return currentStreak(activityDays(), today);
    case 'post-count':
      return publicPostCount();
  }
}

const UNITS: Record<StatKind, string> = {
  'site-days': '天', 'uptime-streak': '天', 'publish-days': '天', 'publish-streak': '天', 'learning-streak': '天', 'post-count': '篇',
};

/**
 * Stats for visitors. Only enabled + explicitly public stats are computed,
 * so private data (e.g. learning activity) never reaches public HTML unless
 * the owner whitelisted that specific stat.
 */
export function publicStats(siteId?: string): StatValue[] {
  return listStatDefs()
    // siteIds null = whole site; otherwise only on pages of the listed sites.
    .filter((d) => d.enabled && d.public && (!d.siteIds || (!!siteId && d.siteIds.includes(siteId))))
    .map((d) => ({ ...d, value: computeStat(d), unit: UNITS[d.kind] }));
}

export function ownerStats(): StatValue[] {
  return listStatDefs().map((d) => ({ ...d, value: computeStat(d), unit: UNITS[d.kind] }));
}

export function growthSummary() {
  const db = getDb();
  const q = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    totalPosts: q('SELECT COUNT(*) AS n FROM posts'),
    published: q(`SELECT COUNT(*) AS n FROM posts WHERE status = 'published'`),
    drafts: q(`SELECT COUNT(*) AS n FROM posts WHERE status = 'draft'`),
    paperNotes: q(`SELECT COUNT(*) AS n FROM posts WHERE template_id = 'paper'`),
    papersDeepRead: q(`SELECT COUNT(*) AS n FROM papers WHERE read_status IN ('read','deep-read')`),
    papersTotal: q('SELECT COUNT(*) AS n FROM papers'),
    reproduced: q(`SELECT COUNT(*) AS n FROM papers WHERE reproduced = 'done'`),
    tasksDone: q(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'`),
    learningLongest: longestStreak(activityDays()),
  };
}
