import { getDb, now } from '../db';

/** Local calendar day (server timezone, configurable via TZ) as YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Private learning activity log (post saves, task completions, manual check-ins). */
export function recordActivity(kind: 'post-save' | 'task-done' | 'checkin', at: Date = new Date()): void {
  getDb()
    .prepare(
      `INSERT INTO activity (day, kind, count) VALUES (?, ?, 1)
       ON CONFLICT(day, kind) DO UPDATE SET count = count + 1`,
    )
    .run(dayKey(at), kind);
}

export function activityDays(): string[] {
  return (getDb().prepare('SELECT DISTINCT day FROM activity ORDER BY day').all() as { day: string }[]).map((r) => r.day);
}

export function activityHeatmap(days = 120): Record<string, number> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = getDb()
    .prepare('SELECT day, SUM(count) AS n FROM activity WHERE day >= ? GROUP BY day')
    .all(dayKey(since)) as { day: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.day, r.n]));
}

/** Record that the service (or an external monitor) was up today. */
export function heartbeat(source = 'self', at: Date = new Date()): void {
  getDb()
    .prepare(
      `INSERT INTO heartbeats (day, source, count, last_at) VALUES (?, ?, 1, ?)
       ON CONFLICT(day, source) DO UPDATE SET count = count + 1, last_at = excluded.last_at`,
    )
    .run(dayKey(at), source, now());
}

export function heartbeatDays(): string[] {
  return (getDb().prepare('SELECT DISTINCT day FROM heartbeats ORDER BY day').all() as { day: string }[]).map((r) => r.day);
}
