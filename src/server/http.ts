import crypto from 'node:crypto';
import type { APIContext } from 'astro';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { formatZodError } from './validation';
import { CSRF_HEADER, safeEqual } from './auth/session';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) return json({ error: formatZodError(err) }, 400);
  if (err instanceof AppError) return json({ error: err.message }, err.status);
  if (err instanceof SyntaxError) return json({ error: '请求格式错误' }, 400);
  console.error(err);
  return json({ error: '服务器内部错误' }, 500);
}

/** Wrap an API handler with uniform error handling. */
export function handle(fn: (ctx: APIContext) => Promise<unknown> | unknown) {
  return async (ctx: APIContext): Promise<Response> => {
    try {
      const out = await fn(ctx);
      if (out instanceof Response) return out;
      return json(out ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function body(ctx: APIContext): Promise<unknown> {
  const type = ctx.request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new AppError(415, '需要 JSON 请求体');
  return ctx.request.json();
}

/**
 * Same-origin check for state-changing requests: Origin (or Referer) must
 * match the host the browser addressed (Host / X-Forwarded-Host from the
 * reverse proxy) or the configured SITE_URL.
 */
export function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = new Set<string>([url.host]);
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (host) allowed.add(host);
  for (const s of [process.env.SITE_URL, ...(process.env.EXTRA_ORIGINS ?? '').split(',')]) {
    if (!s?.trim()) continue;
    try {
      allowed.add(new URL(s.trim()).host);
    } catch {
      /* ignore malformed */
    }
  }
  return allowed.has(originHost);
}

export function csrfOk(request: Request, expected: string): boolean {
  const got = request.headers.get(CSRF_HEADER);
  return !!got && safeEqual(got, expected);
}

export function clientIp(ctx: APIContext): string {
  // Behind the bundled Caddy proxy every request comes from the proxy; trust
  // its X-Forwarded-For only when explicitly configured.
  if (process.env.TRUST_PROXY === 'true') {
    const fwd = ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (fwd) return fwd;
  }
  try {
    return ctx.clientAddress || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function randomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
