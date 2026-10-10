/**
 * The ONE place that decides whether content is visible to visitors.
 *
 * A post is public iff:
 *   status = 'published' ∧ visibility = 'public'
 *   ∧ its category is public ∧ its site is public
 *   ∧ published_at <= now   (a future published_at = scheduled publishing)
 *
 * Every public page, search, RSS, sitemap, tag and archive query must go
 * through PUBLIC_POST_SQL / isPublicPost. Never filter private content on the client.
 */

export const PUBLIC_POST_SQL = `
  p.status = 'published'
  AND p.visibility = 'public'
  AND c.visibility = 'public'
  AND s.visibility = 'public'
  AND p.published_at IS NOT NULL
  AND p.published_at <= @now
`;

/** FROM clause that PUBLIC_POST_SQL expects (aliases p, c, s). */
export const POST_JOIN_SQL = `
  posts p
  JOIN categories c ON c.id = p.category_id
  JOIN sites s ON s.id = c.site_id
`;

export interface VisibilityInput {
  status: string;
  visibility: string;
  publishedAt: string | null;
  categoryVisibility: string;
  siteVisibility: string;
}

export function isPublicPost(p: VisibilityInput, at: Date = new Date()): boolean {
  return (
    p.status === 'published' &&
    p.visibility === 'public' &&
    p.categoryVisibility === 'public' &&
    p.siteVisibility === 'public' &&
    p.publishedAt !== null &&
    p.publishedAt <= at.toISOString()
  );
}

/** Human-readable reason a post is hidden from visitors (for the owner UI). */
export function hiddenReason(p: VisibilityInput, at: Date = new Date()): string | null {
  if (p.status === 'draft') return '草稿';
  if (p.status === 'archived') return '已归档';
  if (p.visibility !== 'public') return '仅自己可见';
  if (p.siteVisibility !== 'public') return '所属分站未公开';
  if (p.categoryVisibility !== 'public') return '所属栏目未公开';
  if (!p.publishedAt) return '未发布';
  if (p.publishedAt > at.toISOString()) return '定时发布中';
  return null;
}
