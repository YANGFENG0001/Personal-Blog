import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deleteTemplate, saveTemplate } from '../../../../server/services/config';

export const PUT: APIRoute = handle(async (ctx) => saveTemplate({ ...((await body(ctx)) as object), id: ctx.params.id }, false));
export const DELETE: APIRoute = handle(({ params }) => deleteTemplate(params.id!));
