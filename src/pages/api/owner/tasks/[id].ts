import type { APIRoute } from 'astro';
import { z } from 'zod';
import { body, handle } from '../../../../server/http';
import { deleteTask, moveTask, setTaskDone, updateTask } from '../../../../server/services/tasks';

const patch = z.object({ done: z.boolean().optional(), boardId: z.string().optional() });

export const PUT: APIRoute = handle(async (ctx) => updateTask(ctx.params.id!, await body(ctx)));
export const PATCH: APIRoute = handle(async (ctx) => {
  const p = patch.parse(await body(ctx));
  let t;
  if (p.boardId) t = moveTask(ctx.params.id!, p.boardId);
  if (p.done !== undefined) t = setTaskDone(ctx.params.id!, p.done);
  return t ?? { ok: true };
});
export const DELETE: APIRoute = handle(({ params }) => deleteTask(params.id!));
