import type { APIRoute } from 'astro';
import { body, handle } from '../../../../../server/http';
import { createTask } from '../../../../../server/services/tasks';

export const POST: APIRoute = handle(async (ctx) => createTask(ctx.params.id!, await body(ctx)));
