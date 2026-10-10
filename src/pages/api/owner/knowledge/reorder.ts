import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { reorderNodes } from '../../../../server/services/knowledge';
import { reorderInput } from '../../../../server/validation';

export const POST: APIRoute = handle(async (ctx) => reorderNodes(reorderInput.parse(await body(ctx)).ids));
