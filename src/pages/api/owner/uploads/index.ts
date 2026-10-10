import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { badRequest } from '../../../../server/errors';
import { listUploads, MAX_UPLOAD, saveUpload } from '../../../../server/services/uploads';

export const GET: APIRoute = handle(() => listUploads());
export const POST: APIRoute = handle(async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('请选择文件');
  if (file.size > MAX_UPLOAD) throw badRequest('文件过大');
  return saveUpload(Buffer.from(await file.arrayBuffer()), file.name);
});
