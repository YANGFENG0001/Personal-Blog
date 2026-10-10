import { z } from 'zod';

/** Slugs end up in URLs; reserved words would shadow top-level routes. */
export const RESERVED_SLUGS = new Set([
  'owner', 'api', 'posts', 'search', 'archive', 'tags', 'rss.xml', 'sitemap.xml', 'robots.txt',
  'uploads', 'knowledge', 'papers', '404', '_astro', 'favicon.svg', 'assets',
]);

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, '不能为空')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '只能包含小写字母、数字和连字符');

export const siteSlug = slug.refine((s) => !RESERVED_SLUGS.has(s), '该名称为系统保留');

export const visibility = z.enum(['public', 'private']);

/** Only http(s) URLs; rejects javascript:, data:, etc. */
export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, '只接受 http:// 或 https:// 链接');

/** Site-relative path (e.g. /uploads/x.png) or http(s) URL. */
export const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^\/uploads\/[a-z0-9._-]+$/i.test(v) || httpUrl.safeParse(v).success, '图片地址无效');

const shortText = (max: number) => z.string().trim().max(max);

export const siteInput = z.object({
  slug: siteSlug,
  name: shortText(40).min(1, '名称不能为空'),
  enName: shortText(40).default(''),
  description: shortText(400).default(''),
  icon: z.enum(['book', 'atom', 'code', 'pen', 'archive', 'star', 'compass', 'flask']).default('book'),
  accent: z.enum(['green', 'blue', 'terracotta']).nullable().default(null),
  visibility: visibility.default('public'),
});

export const categoryInput = z.object({
  siteId: z.string().min(1),
  slug,
  name: shortText(40).min(1, '名称不能为空'),
  description: shortText(400).default(''),
  visibility: visibility.default('public'),
  layout: z.enum(['list', 'cards', 'compact']).default('list'),
});

export const linkInput = z.object({
  label: shortText(120).min(1, '链接名称不能为空'),
  url: httpUrl,
  kind: z.enum(['paper', 'code', 'project', 'docs', 'blog', 'dataset', 'other']).default('other'),
});

export const postInput = z.object({
  title: shortText(200).min(1, '标题不能为空'),
  slug: slug.optional(),
  summary: shortText(1000).default(''),
  categoryId: z.string().min(1, '请选择栏目'),
  tags: z.array(shortText(40).min(1)).max(20).default([]),
  visibility: visibility.default('private'),
  templateId: z.string().max(40).nullable().default(null),
  progress: shortText(40).nullable().default(null),
  progressPublic: z.boolean().default(true),
  bodyMd: z.string().max(500_000).default(''),
  reflectionMd: z.string().max(100_000).default(''),
  reflectionPublic: z.boolean().default(false),
  coverUrl: imageUrl.nullable().default(null),
  featured: z.boolean().default(false),
  links: z.array(linkInput).max(50).default([]),
  /** Optional explicit publish time; a future value schedules the post. */
  publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type PostInput = z.infer<typeof postInput>;

export const boardInput = z.object({
  name: shortText(60).min(1, '名称不能为空'),
  description: shortText(300).default(''),
  showOnDashboard: z.boolean().default(true),
});

export const taskInput = z.object({
  title: shortText(300).min(1, '任务内容不能为空'),
  note: shortText(4000).default(''),
  priority: shortText(30).nullable().default(null),
  dueDate: z.iso.date().nullable().default(null),
  postId: z.string().nullable().default(null),
});

export const reorderInput = z.object({ ids: z.array(z.string().min(1)).max(1000) });

export const loginInput = z.object({
  username: shortText(80).min(1),
  password: z.string().min(1).max(1000),
  remember: z.boolean().default(false),
});

export const templateInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/, 'ID 只能包含小写字母、数字和连字符'),
  name: shortText(40).min(1),
  description: shortText(200).default(''),
  bodyMd: z.string().max(100_000).default(''),
  reflectionMd: z.string().max(20_000).default(''),
  defaultProgress: shortText(40).nullable().default(null),
  progressOptions: z.array(shortText(40).min(1)).max(30).default([]),
});

export const quoteInput = z.object({
  text: shortText(500).min(1),
  author: shortText(100).min(1, '请填写作者，避免无出处的引用'),
  source: shortText(200).default(''),
  followUp: shortText(600).default(''),
  category: shortText(20).default(''),
  enabled: z.boolean().default(true),
});

export const statDefInput = z.object({
  label: shortText(40).min(1),
  enabled: z.boolean(),
  public: z.boolean(),
  siteIds: z.array(z.string()).nullable().default(null),
  startDate: z.iso.date().nullable().default(null),
});

export const moduleInput = z.object({
  name: shortText(40).min(1),
  enabled: z.boolean(),
  visibleTo: z.enum(['public', 'owner']),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const knowledgeNodeInput = z.object({
  parentId: z.string().nullable().default(null),
  slug,
  title: shortText(80).min(1),
  description: shortText(1000).default(''),
  visibility: visibility.default('private'),
});

export const paperInput = z.object({
  title: shortText(300).min(1),
  authors: shortText(500).default(''),
  year: z.number().int().min(1900).max(2100).nullable().default(null),
  venue: shortText(120).default(''),
  url: httpUrl.nullable().default(null),
  codeUrl: httpUrl.nullable().default(null),
  direction: shortText(80).default(''),
  readStatus: z.enum(['to-read', 'reading', 'read', 'deep-read']).default('to-read'),
  reproduced: z.enum(['no', 'in-progress', 'done']).default('no'),
  abstract: z.string().max(5000).default(''),
  postId: z.string().nullable().default(null),
});

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('；');
}
