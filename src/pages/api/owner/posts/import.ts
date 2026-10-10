import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { badRequest } from '../../../../server/errors';
import { MAX_IMPORT_BYTES, parseMarkdownImport } from '../../../../lib/markdown/frontmatter';

/** Parses an uploaded .md file. Returns editor fields; never creates or publishes a post. */
export const POST: APIRoute = handle(async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('请选择文件');
  if (!/\.(md|markdown)$/i.test(file.name)) throw badRequest('只支持 .md / .markdown 文件');
  if (file.size > MAX_IMPORT_BYTES) throw badRequest(`文件不能超过 ${MAX_IMPORT_BYTES / 1024 / 1024}MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    throw badRequest('文件不是有效的 UTF-8 文本');
  }
  if (text.includes('\u0000')) throw badRequest('文件看起来不是文本文件');
  return parseMarkdownImport(text, file.name);
});
