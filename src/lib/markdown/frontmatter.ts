import YAML from 'yaml';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export interface ImportedMarkdown {
  title: string;
  summary: string;
  tags: string[];
  date: string | null;
  slug: string | null;
  body: string;
  warnings: string[];
}

const FM = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

/**
 * Parse an imported .md file: optional YAML front matter + body.
 * Never publishes anything — the result only pre-fills the editor.
 */
export function parseMarkdownImport(text: string, filename = ''): ImportedMarkdown {
  const warnings: string[] = [];
  let meta: Record<string, unknown> = {};
  let body = text.replace(/^﻿/, '');
  const m = FM.exec(body);
  if (m) {
    try {
      const parsed = YAML.parse(m[1]!, { maxAliasCount: 10 });
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>;
      else warnings.push('front matter 不是键值对，已忽略');
    } catch {
      warnings.push('front matter 解析失败，已按正文导入');
    }
    body = body.slice(m[0].length);
  }

  let title = str(meta.title);
  if (!title) {
    const h1 = /^#\s+(.+)$/m.exec(body);
    if (h1) {
      title = h1[1]!.trim();
      body = body.replace(h1[0], '').replace(/^\s*\n/, '');
    }
  }
  if (!title) title = filename.replace(/\.(md|markdown)$/i, '').trim() || '未命名文章';

  let tags: string[] = [];
  const rawTags = meta.tags ?? meta.tag ?? meta.keywords;
  if (Array.isArray(rawTags)) tags = rawTags.map(str).filter(Boolean);
  else if (typeof rawTags === 'string') tags = rawTags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);

  let date: string | null = null;
  const rawDate = meta.date ?? meta.published ?? meta.pubDate;
  if (rawDate) {
    const d = rawDate instanceof Date ? rawDate : new Date(str(rawDate));
    if (!Number.isNaN(d.getTime())) date = d.toISOString();
    else warnings.push('日期格式无法识别，已忽略');
  }

  const slugRaw = str(meta.slug);
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugRaw) ? slugRaw : null;
  if (slugRaw && !slug) warnings.push('slug 格式无效，已忽略');

  if (/!\[[^\]]*\]\((?!https?:\/\/|\/uploads\/)[^)]+\)/.test(body)) {
    warnings.push('正文含有本地相对路径图片，请上传图片后替换链接');
  }

  return {
    title: title.slice(0, 200),
    summary: str(meta.summary ?? meta.description ?? meta.excerpt).slice(0, 1000),
    tags: tags.slice(0, 20).map((t) => t.slice(0, 40)),
    date,
    slug,
    body: body.trimStart(),
    warnings,
  };
}

/** Export a post back to portable Markdown with front matter. */
export function toMarkdownFile(p: {
  title: string; slug: string; summary: string; tags: string[]; publishedAt: string | null; bodyMd: string;
}): string {
  const fm: Record<string, unknown> = { title: p.title, slug: p.slug };
  if (p.summary) fm.summary = p.summary;
  if (p.tags.length) fm.tags = p.tags;
  if (p.publishedAt) fm.date = p.publishedAt;
  return `---\n${YAML.stringify(fm).trimEnd()}\n---\n\n${p.bodyMd.trimEnd()}\n`;
}
