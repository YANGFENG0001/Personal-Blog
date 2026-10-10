import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { createBoard, listBoards } from '../../../../server/services/tasks';

export const GET: APIRoute = handle(() => listBoards());
export const POST: APIRoute = handle(async (ctx) => createBoard(await body(ctx)));
