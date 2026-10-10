import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { reorder } from '../../../../server/services/sites';
import { reorderInput } from '../../../../server/validation';

export const POST: APIRoute = handle(async (ctx) => reorder('sites', reorderInput.parse(await body(ctx)).ids));
