import type { APIRoute } from 'astro';
import { zipSync, strToU8 } from 'fflate';
import { getDb } from '../../../../server/db';
import { handle } from '../../../../server/http';
import { getPost } from '../../../../server/services/posts';
import { toMarkdownFile } from '../../../../lib/markdown/frontmatter';

/** All posts as Markdown + front matter, grouped by site/category, in a zip. */
export const GET: APIRoute = handle(() => {
  const ids = getDb().prepare('SELECT id FROM posts ORDER BY created_at').all() as { id: string }[];
  const files: Record<string, Uint8Array> = {};
  for (const { id } of ids) {
    const p = getPost(id)!;
    const dir = `${p.status}/${p.siteSlug}/${p.categorySlug}`;
    files[`${dir}/${p.slug}.md`] = strToU8(toMarkdownFile(p));
  }
  const zip = zipSync(files);
  return new Response(zip, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="fieldnotes-posts-${new Date().toISOString().slice(0, 10)}.zip"`,
      'cache-control': 'no-store',
    },
  });
});
