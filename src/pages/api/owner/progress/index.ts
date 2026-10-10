import type { APIRoute } from 'astro';
import { z } from 'zod';
import { body, handle } from '../../../../server/http';
import { listProgressOptions, setProgressOptions } from '../../../../server/services/config';

export const GET: APIRoute = handle(() => listProgressOptions());
export const PUT: APIRoute = handle(async (ctx) =>
  setProgressOptions(z.object({ labels: z.array(z.string().max(40)).max(40) }).parse(await body(ctx)).labels),
);
