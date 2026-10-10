import { getDb } from '../db';

/**
 * Login throttling, persisted in SQLite so restarts don't reset it.
 * A key is blocked after MAX failures within WINDOW.
 */
const WINDOW = 15 * 60_000;
const MAX = 5;

export function isBlocked(keys: string[], nowMs = Date.now()): { blocked: boolean; retryAfterSec: number } {
  const db = getDb();
  db.prepare('DELETE FROM login_attempts WHERE at < ?').run(nowMs - WINDOW);
  let retry = 0;
  for (const key of keys) {
    const rows = db.prepare('SELECT at FROM login_attempts WHERE key = ? ORDER BY at').all(key) as { at: number }[];
    if (rows.length >= MAX) retry = Math.max(retry, Math.ceil((rows[rows.length - MAX]!.at + WINDOW - nowMs) / 1000));
  }
  return { blocked: retry > 0, retryAfterSec: retry };
}

export function recordFailure(keys: string[], nowMs = Date.now()): void {
  const ins = getDb().prepare('INSERT INTO login_attempts (key, at) VALUES (?, ?)');
  for (const k of keys) ins.run(k, nowMs);
}

export function clearFailures(keys: string[]): void {
  const del = getDb().prepare('DELETE FROM login_attempts WHERE key = ?');
  for (const k of keys) del.run(k);
}
