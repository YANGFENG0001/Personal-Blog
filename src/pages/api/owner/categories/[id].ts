import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deleteCategory, updateCategory } from '../../../../server/services/sites';

export const PUT: APIRoute = handle(async (ctx) => updateCategory(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params, url }) => deleteCategory(params.id!, url.searchParams.get('moveTo')));
