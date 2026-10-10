import type { APIRoute } from 'astro';
import { heartbeat } from '../../server/services/activity';
import { safeEqual } from '../../server/auth/session';

/**
 * External uptime monitor hook. Configure HEARTBEAT_TOKEN, then point a
 * monitor (UptimeRobot, cron + curl, …) at /api/heartbeat?token=<token>.
 * Each successful call records "online today" from source "monitor".
 */
export const GET: APIRoute = ({ url }) => {
  const expected = process.env.HEARTBEAT_TOKEN;
  const got = url.searchParams.get('token') ?? '';
  if (!expected || !safeEqual(got, expected)) return new Response('forbidden', { status: 403 });
  heartbeat('monitor');
  return new Response('ok', { headers: { 'cache-control': 'no-store' } });
};
