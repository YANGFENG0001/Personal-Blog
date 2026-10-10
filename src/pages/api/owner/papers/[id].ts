import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deletePaper, savePaper } from '../../../../server/services/knowledge';

export const PUT: APIRoute = handle(async (ctx) => savePaper(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params }) => deletePaper(params.id!));
