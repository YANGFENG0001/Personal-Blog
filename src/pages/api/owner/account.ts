import type { APIRoute } from 'astro';
import { z } from 'zod';
import { body, handle, json } from '../../../server/http';
import { checkCredentials, upsertOwner } from '../../../server/auth/session';
import { passwordProblems } from '../../../server/auth/password';

const input = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
  username: z.string().trim().min(1).max(80),
});

/** Change username/password. Signs out every session, including this one. */
export const PUT: APIRoute = handle(async (ctx) => {
  const i = input.parse(await body(ctx));
  if (!(await checkCredentials(ctx.locals.owner!.username, i.currentPassword))) return json({ error: '当前密码不正确' }, 400);
  const problem = passwordProblems(i.newPassword);
  if (problem) return json({ error: problem }, 400);
  await upsertOwner(i.username, i.newPassword);
  return { ok: true, signedOut: true };
});
