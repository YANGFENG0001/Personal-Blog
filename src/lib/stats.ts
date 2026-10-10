/**
 * Pure statistics helpers. All inputs are YYYY-MM-DD day keys, so the
 * functions are deterministic and easy to unit-test.
 */

const DAY = 86_400_000;

function toUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function addDays(day: string, n: number): string {
  return new Date(toUtc(day) + n * DAY).toISOString().slice(0, 10);
}

/** Days from `start` to `today`, inclusive. 0 if start is in the future. */
export function daysSince(start: string, today: string): number {
  const diff = Math.floor((toUtc(today) - toUtc(start)) / DAY) + 1;
  return Math.max(0, diff);
}

/** Number of distinct days. */
export function distinctDays(days: Iterable<string>): number {
  return new Set(days).size;
}

/**
 * Length of the run of consecutive days ending today — or ending yesterday
 * when `allowGrace` is true (so a streak isn't "broken" before today is over).
 */
export function currentStreak(days: Iterable<string>, today: string, allowGrace = true): number {
  const set = new Set(days);
  let cursor = today;
  if (!set.has(cursor)) {
    if (!allowGrace) return 0;
    cursor = addDays(today, -1);
    if (!set.has(cursor)) return 0;
  }
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Longest run of consecutive days anywhere in the set. */
export function longestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
