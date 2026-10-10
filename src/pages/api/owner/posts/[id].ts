import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { notFound } from '../../../../server/errors';
import { deletePost, getPost, savePost, type SaveAction } from '../../../../server/services/posts';

const ACTIONS: SaveAction[] = ['save', 'publish', 'unpublish', 'archive'];

export const GET: APIRoute = handle(({ params }) => {
  const p = getPost(params.id!);
  if (!p) throw notFound('文章');
  return p;
});

export const PUT: APIRoute = handle(async (ctx) => {
  const { action = 'save', ...data } = (await body(ctx)) as { action?: SaveAction };
  return savePost(ctx.params.id!, data, ACTIONS.includes(action) ? action : 'save');
});

export const DELETE: APIRoute = handle(({ params }) => deletePost(params.id!));
