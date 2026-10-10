import type { APIRoute } from 'astro';
import { z } from 'zod';
import { body, handle } from '../../../../server/http';
import { deleteNode, setNodePosts, updateNode } from '../../../../server/services/knowledge';

export const PUT: APIRoute = handle(async (ctx) => updateNode(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params }) => deleteNode(params.id!));
/** Replace the ordered list of posts attached to this node. */
export const PATCH: APIRoute = handle(async (ctx) =>
  setNodePosts(ctx.params.id!, z.object({ postIds: z.array(z.string()).max(500) }).parse(await body(ctx)).postIds),
);
