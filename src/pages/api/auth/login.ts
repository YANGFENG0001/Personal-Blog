import type { APIRoute } from 'astro';
import { checkCredentials, createSession, SESSION_COOKIE } from '../../../server/auth/session';
import { clearFailures, isBlocked, recordFailure } from '../../../server/auth/rateLimit';
import { body, clientIp, handle, json, sameOrigin } from '../../../server/http';
import { loginInput } from '../../../server/validation';

export const POST: APIRoute = handle(async (ctx) => {
  if (!sameOrigin(ctx.request, ctx.url)) return json({ error: '来源校验失败' }, 403);
  const input = loginInput.parse(await body(ctx));
  const ip = clientIp(ctx);
  const keys = [`ip:${ip}`, `user:${input.username.toLowerCase()}`];
  const block = isBlocked(keys);
  if (block.blocked) {
    return json({ error: `尝试次数过多，请在 ${Math.ceil(block.retryAfterSec / 60)} 分钟后重试` }, 429, {
      'retry-after': String(block.retryAfterSec),
    });
  }
  const userId = await checkCredentials(input.username, input.password);
  if (!userId) {
    recordFailure(keys);
    return json({ error: '用户名或密码错误' }, 401);
  }
  clearFailures(keys);
  const s = createSession(userId, input.remember, { ua: ctx.request.headers.get('user-agent') ?? undefined, ip });
  ctx.cookies.set(SESSION_COOKIE, s.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production',
    path: '/',
    // Without "remember me" it's a browser-session cookie (server still expires it after 12h).
    ...(s.remember ? { expires: s.expires } : {}),
  });
  return { ok: true };
});
