import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { createTheme, listThemes } from '../../../../server/services/custom-themes';

export const GET: APIRoute = handle(() => listThemes());
export const POST: APIRoute = handle(async (ctx) => createTheme(await body(ctx)));
