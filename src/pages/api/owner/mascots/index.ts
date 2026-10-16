import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { badRequest } from '../../../../server/errors';
import { importPack, listPacks } from '../../../../server/services/mascot-packs';

export const GET: APIRoute = handle(() => listPacks());
export const POST: APIRoute = handle(async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('请选择角色包 .zip 文件');
  return importPack(Buffer.from(await file.arrayBuffer()));
});
