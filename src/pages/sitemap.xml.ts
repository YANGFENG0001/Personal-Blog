import type { APIRoute } from 'astro';
import { listPublicArchive, listPublicTags } from '../server/services/posts';
import { publicSiteTree } from '../server/services/sites';
import { publicKnowledgeTree, type KnowledgeNode } from '../server/services/knowledge';
import { escapeXml, postUrl } from '../lib/format';

export const GET: APIRoute = ({ site, url }) => {
  const base = site ?? url;
  const entries: { loc: string; lastmod?: string }[] = [
    { loc: '/' }, { loc: '/archive' }, { loc: '/tags' }, { loc: '/knowledge' },
  ];
  for (const s of publicSiteTree()) {
    entries.push({ loc: `/${s.slug}` });
    for (const c of s.categories) entries.push({ loc: `/${s.slug}/${c.slug}` });
  }
  for (const p of listPublicArchive()) entries.push({ loc: postUrl(p), lastmod: p.updatedAt });
  for (const t of listPublicTags()) entries.push({ loc: `/tags/${encodeURIComponent(t.tag)}` });
  const walk = (nodes: KnowledgeNode[]) => {
    for (const n of nodes) {
      entries.push({ loc: `/knowledge/${n.slug}` });
      walk(n.children);
    }
  };
  walk(publicKnowledgeTree());
  const urls = entries
    .map((e) => `<url><loc>${escapeXml(new URL(e.loc, base).href)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' },
  });
};
