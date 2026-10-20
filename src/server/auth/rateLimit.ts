import { getDb } from '../db';

/**
 * Login throttling, persisted in SQLite so restarts don't reset it.
 * A key is blocked once it has MAX_ATTEMPTS failures inside WINDOW.
 *
 * Two keys are tracked per attempt — the visitor IP and the username:
 * the IP key stops one host from spraying many accounts, the username key
 * stops a botnet from spraying one account. Because the username key is
 * shared, any successful login clears it for everyone.
 */
const WINDOW = 15 * 60_000;
export const MAX_ATTEMPTS = 5;

/** Drop rows that fell out of the window. Uses the (at) index. */
function prune(nowMs: number): void {
  getDb().prepare('DELETE FROM login_attempts WHERE at < ?').run(nowMs - WINDOW);
}

function countFor(key: string, nowMs: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE key = ? AND at >= ?')
    .get(key, nowMs - WINDOW) as { c: number };
  return row.c;
}

export function isBlocked(keys: string[], nowMs = Date.now()): { blocked: boolean; retryAfterSec: number } {
  prune(nowMs);
  let retry = 0;
  for (const key of keys) {
    const rows = getDb()
      .prepare('SELECT at FROM login_attempts WHERE key = ? AND at >= ? ORDER BY at')
      .all(key, nowMs - WINDOW) as { at: number }[];
    if (rows.length >= MAX_ATTEMPTS) {
      // The block lifts when the oldest failure that still counts ages out.
      retry = Math.max(retry, Math.ceil((rows[rows.length - MAX_ATTEMPTS]!.at + WINDOW - nowMs) / 1000));
    }
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

/** Attempts left before the block kicks in — the smallest across keys. */
export function remainingAttempts(keys: string[], nowMs = Date.now()): number {
  let worst = 0;
  for (const key of keys) worst = Math.max(worst, countFor(key, nowMs));
  return Math.max(0, MAX_ATTEMPTS - worst);
}
