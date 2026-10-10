import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { createCategory } from '../../../../server/services/sites';

export const POST: APIRoute = handle(async (ctx) => createCategory(await body(ctx)));
