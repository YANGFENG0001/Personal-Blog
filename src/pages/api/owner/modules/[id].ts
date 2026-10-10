import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { updateModule } from '../../../../server/services/config';

export const PUT: APIRoute = handle(async (ctx) => updateModule(ctx.params.id!, await body(ctx)));
