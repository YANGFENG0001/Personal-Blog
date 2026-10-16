import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deleteTheme, exportTheme, getTheme, listVersions, rollbackTheme, updateTheme } from '../../../../server/services/custom-themes';
import { badRequest, notFound } from '../../../../server/errors';

export const GET: APIRoute = handle(({ params, url }) => {
  const id = params.id!;
  if (url.searchParams.has('versions')) return listVersions(id);
  if (url.searchParams.has('export')) {
    const data = exportTheme(id);
    const name = `${data.name.replace(/[^\w一-龥-]+/g, '_')}.theme.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
      },
    });
  }
  return getTheme(id) ?? (() => { throw notFound('主题'); })();
});
export const PUT: APIRoute = handle(async (ctx) => updateTheme(ctx.params.id!, await body(ctx)));
export const POST: APIRoute = handle(async (ctx) => {
  const b = (await body(ctx)) as { rollback?: number };
  if (typeof b?.rollback !== 'number') throw badRequest('缺少 rollback 版本号');
  return rollbackTheme(ctx.params.id!, b.rollback);
});
export const DELETE: APIRoute = handle(({ params }) => deleteTheme(params.id!));
