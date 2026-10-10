import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db';
import { handle } from '../../../server/http';

const TABLES = [
  'sites', 'categories', 'posts', 'post_links', 'post_tags', 'post_redirects', 'templates', 'progress_options',
  'task_boards', 'tasks', 'settings', 'quotes', 'stat_defs', 'site_modules', 'activity', 'heartbeats', 'uploads',
  'knowledge_nodes', 'knowledge_node_posts', 'papers',
];

/** Full JSON export of content tables (no credentials or sessions). */
export const GET: APIRoute = handle(() => {
  const db = getDb();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify({ format: 'fieldnotes-backup', version: 1, exportedAt: new Date().toISOString(), data }, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="fieldnotes-backup-${day}.json"`,
      'cache-control': 'no-store',
    },
  });
});
