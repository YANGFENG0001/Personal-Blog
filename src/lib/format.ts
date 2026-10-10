const DATE_FMT = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
const MONTH_FMT = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' });

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return DATE_FMT.format(new Date(iso)).replace(/\//g, '-');
}

export function fmtMonth(iso: string): string {
  return MONTH_FMT.format(new Date(iso));
}

export function postUrl(p: { siteSlug: string; categorySlug: string; slug: string }): string {
  return `/${p.siteSlug}/${p.categorySlug}/${encodeURIComponent(p.slug)}`;
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.round(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} 天前`;
  return fmtDate(iso);
}
