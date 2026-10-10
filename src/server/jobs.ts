import { heartbeat } from './services/activity';

let started = false;

/**
 * In-process uptime heartbeat every 5 minutes. Safe to call repeatedly.
 * (Scheduled publishing needs no job: the visibility gate compares
 * published_at with the current time on every query.)
 */
export function startBackgroundJobs(): void {
  if (started || process.env.VITEST) return;
  started = true;
  const tick = () => {
    try {
      heartbeat('self');
    } catch (err) {
      console.error('[jobs]', err);
    }
  };
  tick();
  setInterval(tick, 5 * 60_000).unref();
}
