import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { deletePack, updatePack } from '../../../../server/services/mascot-packs';

export const PUT: APIRoute = handle(async (ctx) => updatePack(ctx.params.id!, await body(ctx)));
export const DELETE: APIRoute = handle(({ params }) => deletePack(params.id!));
