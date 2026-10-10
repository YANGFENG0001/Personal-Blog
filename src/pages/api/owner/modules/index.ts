import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { listModules } from '../../../../server/services/config';

export const GET: APIRoute = handle(() => listModules());
