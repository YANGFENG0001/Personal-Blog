import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { listPapers, savePaper } from '../../../../server/services/knowledge';

export const GET: APIRoute = handle(({ url }) =>
  listPapers({
    readStatus: url.searchParams.get('readStatus') ?? undefined,
    direction: url.searchParams.get('direction') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
  }),
);
export const POST: APIRoute = handle(async (ctx) => savePaper(null, await body(ctx)));
