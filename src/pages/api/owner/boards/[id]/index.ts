import type { APIRoute } from 'astro';
import { body, handle } from '../../../../../server/http';
import { deleteBoard, updateBoard } from '../../../../../server/services/tasks';

export const PUT: APIRoute = handle(async (ctx) => updateBoard(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params }) => deleteBoard(params.id!));
