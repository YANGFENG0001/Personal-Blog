import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { notFound } from '../../../../server/errors';
import { getSetting, isSettingsKey, setSetting } from '../../../../server/services/settings';

export const GET: APIRoute = handle((ctx) => {
  const key = ctx.params.key!;
  if (!isSettingsKey(key)) throw notFound('设置项');
  return getSetting(key);
});

export const PUT: APIRoute = handle(async (ctx) => {
  const key = ctx.params.key!;
  if (!isSettingsKey(key)) throw notFound('设置项');
  return setSetting(key, await body(ctx));
});
