import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { createNode, knowledgeTree } from '../../../../server/services/knowledge';

export const GET: APIRoute = handle(() => knowledgeTree());
export const POST: APIRoute = handle(async (ctx) => createNode(await body(ctx)));
