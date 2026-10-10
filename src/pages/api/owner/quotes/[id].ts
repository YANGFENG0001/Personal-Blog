import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deleteQuote, updateQuote } from '../../../../server/services/config';

export const PUT: APIRoute = handle(async (ctx) => updateQuote(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params }) => deleteQuote(params.id!));
