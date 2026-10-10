import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deleteSite, updateSite } from '../../../../server/services/sites';

export const PUT: APIRoute = handle(async (ctx) => updateSite(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params }) => deleteSite(params.id!));
