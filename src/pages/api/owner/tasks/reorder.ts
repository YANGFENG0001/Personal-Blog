import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { reorderTasks } from '../../../../server/services/tasks';
import { reorderInput } from '../../../../server/validation';

export const POST: APIRoute = handle(async (ctx) => reorderTasks(reorderInput.parse(await body(ctx)).ids));
