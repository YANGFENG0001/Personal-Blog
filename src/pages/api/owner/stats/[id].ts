import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { updateStatDef } from '../../../../server/services/stats';

export const PUT: APIRoute = handle(async (ctx) => updateStatDef(ctx.params.id!, await body(ctx)));
