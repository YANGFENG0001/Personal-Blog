import type { APIRoute } from 'astro';
import { handle } from '../../../../server/http';
import { deleteUpload } from '../../../../server/services/uploads';

export const DELETE: APIRoute = handle(({ params }) => deleteUpload(params.id!));
