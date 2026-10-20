import type { APIRoute } from 'astro';
import { checkCredentials, createSession, SESSION_COOKIE } from '../../../server/auth/session';
import { clearFailures, isBlocked, recordFailure, remainingAttempts } from '../../../server/auth/rateLimit';
import { body, clientIp, handle, json, sameOrigin } from '../../../server/http';
import { loginInput } from '../../../server/validation';

export const POST: APIRoute = handle(async (ctx) => {
  if (!sameOrigin(ctx.request, ctx.url)) return json({ error: '来源校验失败' }, 403);
  const input = loginInput.parse(await body(ctx));
  const ip = clientIp(ctx);
  const username = input.username.toLowerCase();
  const keys = [`ip:${ip}`, `user:${username}`];

  // Checked before the password hash so a blocked client costs one indexed read,
  // not a full KDF run.
  const block = isBlocked(keys);
  if (block.blocked) {
    return json({ error: `尝试次数过多，请在 ${Math.ceil(block.retryAfterSec / 60)} 分钟后重试` }, 429, {
      'retry-after': String(block.retryAfterSec),
    });
  }

  const userId = await checkCredentials(input.username, input.password);
  if (!userId) {
    recordFailure(keys);
    const after = isBlocked(keys);
    if (after.blocked) {
      console.warn(`[auth] 登录失败次数达到上限，已锁定 15 分钟：ip=${ip} user=${username}`);
      return json({ error: `尝试次数过多，请在 ${Math.ceil(after.retryAfterSec / 60)} 分钟后重试` }, 429, {
        'retry-after': String(after.retryAfterSec),
      });
    }
    return json({ error: `用户名或密码错误，还可尝试 ${remainingAttempts(keys)} 次` }, 401);
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
