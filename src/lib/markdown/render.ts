import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import type { Root, Element } from 'hast';
import type { Options as SanitizeSchema } from 'rehype-sanitize';
import type { KatexOptions } from 'katex';

export interface TocItem {
  depth: number;
  id: string;
  text: string;
}

export interface RenderResult {
  html: string;
  toc: TocItem[];
  readingMinutes: number;
}

/**
 * Sanitize BEFORE KaTeX / Shiki run: user input is cleaned first, then the
 * trusted plugins add their own markup. Math nodes keep the `language-math`
 * / `math-inline` / `math-display` classes so KaTeX can find them.
 */
const schema: SanitizeSchema = {
  ...defaultSchema,
  // Keep heading ids exactly as rehype-slug makes them (no "user-content-" prefix).
  clobberPrefix: '',
  clobber: [],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math', 'math-display']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'math', 'math-inline']],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};

/** External links open in a new tab without leaking opener/referrer. */
function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a') {
        const href = String(node.properties?.href ?? '');
        if (/^https?:\/\//i.test(href)) {
          node.properties = { ...node.properties, target: '_blank', rel: ['noopener', 'noreferrer', 'nofollow'] };
        }
      }
      if (node.tagName === 'img') {
        node.properties = { ...node.properties, loading: 'lazy', decoding: 'async' };
      }
      if (node.tagName === 'table') {
        // Wrap later via CSS; mark for horizontal scrolling on small screens.
        node.properties = { ...node.properties, className: ['md-table'] };
      }
    });
  };
}

function rehypeCollectToc(toc: TocItem[]) {
  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const m = /^h([2-4])$/.exec(node.tagName);
      if (m && node.properties?.id) {
        toc.push({ depth: Number(m[1]), id: String(node.properties.id), text: hastToString(node) });
      }
    });
  };
}

async function build(toc: TocItem[]) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeSlug)
    .use(rehypeCollectToc(toc))
    .use(rehypeExternalLinks)
    .use(rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false } satisfies KatexOptions)
    .use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
      fallbackLanguage: 'text',
      lazy: true,
    })
    .use(rehypeStringify);
}

export function readingMinutes(md: string): number {
  const cjk = (md.match(/[㐀-鿿]/g) ?? []).length;
  const words = md.replace(/[㐀-鿿]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

/** The single Markdown pipeline used by both editor preview and public pages. */
export async function renderMarkdown(md: string): Promise<RenderResult> {
  const toc: TocItem[] = [];
  const processor = await build(toc);
  const file = await processor.process(md);
  return { html: String(file), toc, readingMinutes: readingMinutes(md) };
}
