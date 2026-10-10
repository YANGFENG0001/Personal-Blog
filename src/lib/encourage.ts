/**
 * Encouragement trigger: every `intervalMinutes` a roll happens with the
 * current chance. On a miss, the chance grows by `increment` (capped at
 * `maxChance`). On a hit, it resets to `baseChance` and a cooldown starts.
 * Pure + deterministic given `random`, so it runs identically in tests and
 * in the browser.
 */

export interface EncourageConfig {
  baseChance: number; // percent, 0..100
  increment: number; // percent per missed roll
  maxChance: number; // percent cap
  intervalMinutes: number;
  cooldownMinutes: number;
}

export interface EncourageState {
  chance: number;
  lastShownAt: number | null; // epoch ms
}

export function initialState(cfg: EncourageConfig): EncourageState {
  return { chance: clamp(cfg.baseChance, 0, cfg.maxChance), lastShownAt: null };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

export function inCooldown(cfg: EncourageConfig, s: EncourageState, nowMs: number): boolean {
  return s.lastShownAt !== null && nowMs - s.lastShownAt < cfg.cooldownMinutes * 60_000;
}

/** One roll. Returns whether to show, and the next state. */
export function roll(
  cfg: EncourageConfig,
  s: EncourageState,
  nowMs: number,
  random: () => number = Math.random,
): { show: boolean; state: EncourageState } {
  if (inCooldown(cfg, s, nowMs)) return { show: false, state: s };
  const hit = random() * 100 < s.chance;
  if (hit) return { show: true, state: { chance: initialState(cfg).chance, lastShownAt: nowMs } };
  return { show: false, state: { ...s, chance: clamp(s.chance + cfg.increment, 0, cfg.maxChance) } };
}
