import type { APIRoute } from 'astro';
import { readUpload } from '../../server/services/uploads';
import { AppError } from '../../server/errors';

/**
 * Uploaded images. Files are only ever images (magic-byte checked on upload)
 * with random names, served with nosniff and a sandboxing CSP.
 */
export const GET: APIRoute = ({ params }) => {
  try {
    const { buf, mime } = readUpload(params.file!);
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': mime,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    return new Response('Not found', { status: err instanceof AppError ? err.status : 500 });
  }
};
