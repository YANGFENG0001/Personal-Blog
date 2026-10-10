import type { APIRoute } from 'astro';
import { z } from 'zod';
import { body, handle } from '../../../../server/http';
import { renderMarkdown } from '../../../../lib/markdown/render';

const input = z.object({ markdown: z.string().max(500_000) });

/** Same pipeline as published pages, so preview == production rendering. */
export const POST: APIRoute = handle(async (ctx) => renderMarkdown(input.parse(await body(ctx)).markdown));
