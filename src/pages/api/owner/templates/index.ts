import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { listTemplates, saveTemplate } from '../../../../server/services/config';

export const GET: APIRoute = handle(() => listTemplates());
export const POST: APIRoute = handle(async (ctx) => saveTemplate(await body(ctx), true));
