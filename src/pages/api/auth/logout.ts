import type { APIRoute } from 'astro';
import { destroySession, SESSION_COOKIE } from '../../../server/auth/session';
import { csrfOk, handle, json, sameOrigin } from '../../../server/http';

export const POST: APIRoute = handle((ctx) => {
  const owner = ctx.locals.owner;
  if (owner && (!sameOrigin(ctx.request, ctx.url) || !csrfOk(ctx.request, owner.csrfToken))) {
    return json({ error: 'CSRF 校验失败' }, 403);
  }
  destroySession(ctx.cookies.get(SESSION_COOKIE)?.value);
  ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
  return { ok: true };
});
