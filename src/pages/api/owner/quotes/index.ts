import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { createQuote, listQuotes } from '../../../../server/services/config';

export const GET: APIRoute = handle(() => listQuotes());
export const POST: APIRoute = handle(async (ctx) => createQuote(await body(ctx)));
