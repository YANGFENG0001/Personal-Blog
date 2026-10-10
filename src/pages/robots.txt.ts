import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const sitemap = new URL('/sitemap.xml', site ?? url).href;
  const body = ['User-agent: *', 'Disallow: /owner', 'Disallow: /api/', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
