import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { notFound } from '../../../../server/errors';
import { isSettingsKey, setSetting } from '../../../../server/services/settings';

export const PUT: APIRoute = handle(async (ctx) => {
  const key = ctx.params.key!;
  if (!isSettingsKey(key)) throw notFound('设置项');
  return setSetting(key, await body(ctx));
});
