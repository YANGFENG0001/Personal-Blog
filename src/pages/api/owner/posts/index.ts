import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { listPosts, savePost, type SaveAction } from '../../../../server/services/posts';

export const GET: APIRoute = handle(({ url }) => {
  const q = url.searchParams;
  return listPosts({
    q: q.get('q') ?? undefined,
    siteId: q.get('siteId') ?? undefined,
    categoryId: q.get('categoryId') ?? undefined,
    tag: q.get('tag') ?? undefined,
    status: (q.get('status') as never) ?? undefined,
    templateId: q.get('templateId') ?? undefined,
    limit: Math.min(Number(q.get('limit') ?? 50), 200),
    offset: Number(q.get('offset') ?? 0),
  });
});

export const POST: APIRoute = handle(async (ctx) => {
  const { action = 'save', ...data } = (await body(ctx)) as { action?: SaveAction };
  return savePost(null, data, action);
});
