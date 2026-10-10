import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { getAllSettings } from '../../../../server/services/settings';

export const GET: APIRoute = handle(() => getAllSettings());
