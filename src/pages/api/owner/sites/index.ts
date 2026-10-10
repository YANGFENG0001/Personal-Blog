import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { createSite, siteTree } from '../../../../server/services/sites';

export const GET: APIRoute = handle(() => siteTree());
export const POST: APIRoute = handle(async (ctx) => createSite(await body(ctx)));
