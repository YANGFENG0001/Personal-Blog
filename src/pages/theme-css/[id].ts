import type { APIRoute } from 'astro';
import { getTheme } from '../../server/services/custom-themes';
import { checkThemeCss } from '../../lib/custom-theme';

/**
 * Stylesheet for a custom theme: @font-face rules for uploaded fonts plus the
 * owner's custom CSS (re-checked and scoped to html[data-custom-theme]).
 * Served as an external file, so the page CSP stays unchanged.
 */
export const GET: APIRoute = ({ params }) => {
  const id = (params.id ?? '').replace(/\.css$/, '');
  const t = /^[a-f0-9]{16}$/.test(id) ? getTheme(id) : null;
  if (!t) return new Response('/* not found */', { status: 404, headers: { 'content-type': 'text/css; charset=utf-8' } });
  const parts: string[] = [];
  const font = (name: string, url: string) =>
    `@font-face { font-family: '${name}'; src: url("${url.replace(/["\\\n()]/g, '')}") format('woff2'); font-display: swap; }`;
  if (t.typography.displayFont) parts.push(font('FN Theme Display', t.typography.displayFont));
  if (t.typography.bodyFont) parts.push(font('FN Theme Body', t.typography.bodyFont));
  if (t.css.trim()) {
    const c = checkThemeCss(t.css);
    parts.push(c.ok ? c.css : `/* 自定义 CSS 未通过检查，已停用：${c.errors.join('；').replace(/\*\//g, '')} */`);
  }
  return new Response(parts.join('\n'), {
    headers: {
      'content-type': 'text/css; charset=utf-8',
      // The URL carries ?v=updatedAt, so it can be cached for a long time.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
};
