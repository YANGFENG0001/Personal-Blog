import type { APIRoute } from 'astro';
import { listPublicPosts, getPublicPost } from '../server/services/posts';
import { getSetting } from '../server/services/settings';
import { escapeXml, postUrl } from '../lib/format';

export const GET: APIRoute = ({ site, url }) => {
  const base = site ?? url;
  const s = getSetting('site');
  const items = listPublicPosts({ limit: 30 }).items;
  const body = items
    .map((p) => {
      const full = getPublicPost(p.siteSlug, p.categorySlug, p.slug);
      const link = new URL(postUrl(p), base).href;
      const html = full ? `<content:encoded><![CDATA[${full.bodyHtml.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>` : '';
      return [
        '<item>',
        `<title>${escapeXml(p.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="false">${p.id}</guid>`,
        `<pubDate>${new Date(p.publishedAt!).toUTCString()}</pubDate>`,
        `<category>${escapeXml(p.siteName)} / ${escapeXml(p.categoryName)}</category>`,
        ...p.tags.map((t) => `<category>${escapeXml(t)}</category>`),
        `<description>${escapeXml(p.summary)}</description>`,
        html,
        '</item>',
      ].join('\n');
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(s.title)}</title>
<link>${new URL('/', base).href}</link>
<description>${escapeXml(s.intro)}</description>
<language>${escapeXml(s.language)}</language>
<atom:link href="${new URL('/rss.xml', base).href}" rel="self" type="application/rss+xml" />
${items[0] ? `<lastBuildDate>${new Date(items[0].publishedAt!).toUTCString()}</lastBuildDate>` : ''}
${body}
</channel>
</rss>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' },
  });
};
