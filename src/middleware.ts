import { defineMiddleware } from 'astro:middleware';
import { readSession, SESSION_COOKIE } from './server/auth/session';
import { csrfOk, json, sameOrigin } from './server/http';
import { startBackgroundJobs } from './server/jobs';
import { rerenderMissing } from './server/services/posts';

startBackgroundJobs();
// One-time: render HTML for seeded/imported posts before serving anything.
let ready: Promise<unknown> | null = null;

const secureCookies = () => process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production';

function securityHeaders(res: Response, isOwnerArea: boolean): Response {
  const h = res.headers;
  // Astro emits script/style policy (with hashes) per page; append header-only directives.
  const extra = "frame-ancestors 'none'";
  const existing = h.get('content-security-policy');
  h.set('Content-Security-Policy', existing ? `${existing}; ${extra}` : `${extra}; object-src 'none'; base-uri 'self'`);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isOwnerArea) {
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  ready ??= rerenderMissing().catch((err) => console.error('[render]', err));
  await ready;
  const { pathname } = ctx.url;
  ctx.locals.owner = null;
  ctx.locals.preview = false;

  const token = ctx.cookies.get(SESSION_COOKIE)?.value;
  const session = readSession(token);
  if (session) {
    ctx.locals.owner = { userId: session.userId, username: session.username, csrfToken: session.csrfToken };
    if (session.renewedUntil && token) {
      ctx.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true, sameSite: 'lax', secure: secureCookies(), path: '/', expires: session.renewedUntil,
      });
    }
  } else if (token) {
    ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
  }

  const isOwnerApi = pathname.startsWith('/api/owner');
  const isOwnerPage = pathname === '/owner' || pathname.startsWith('/owner/');
  const isLogin = pathname === '/owner/login' || pathname === '/api/auth/login';

  if (isOwnerApi) {
    if (!ctx.locals.owner) return securityHeaders(json({ error: '未登录' }, 401), true);
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(ctx.request.method);
    if (unsafe && (!sameOrigin(ctx.request, ctx.url) || !csrfOk(ctx.request, ctx.locals.owner.csrfToken))) {
      return securityHeaders(json({ error: 'CSRF 校验失败，请刷新页面后重试' }, 403), true);
    }
  }

  if (isOwnerPage && !isLogin && !ctx.locals.owner) {
    return securityHeaders(ctx.redirect('/owner/login', 302), true);
  }

  // Visitor preview: the owner sees exactly what visitors see (public queries only).
  // It only toggles chrome (the floating ball); data access is identical either way.
  ctx.locals.preview = !!ctx.locals.owner && !isOwnerPage && !isOwnerApi;

  const res = await next();
  return securityHeaders(res, isOwnerPage || isOwnerApi || pathname.startsWith('/api/auth'));
});
