import type { APIRoute } from 'astro';
import { body, handle } from '../../../../server/http';
import { validateTheme } from '../../../../server/services/custom-themes';
import { checkThemeCss } from '../../../../lib/custom-theme';

/** Dry-run validation for an imported file or edited CSS: returns problems without saving. */
export const POST: APIRoute = handle(async (ctx) => {
  const b = (await body(ctx)) as { css?: string; theme?: unknown };
  if (typeof b?.css === 'string') return checkThemeCss(b.css);
  try {
    const { warnings } = validateTheme(b?.theme);
    return { ok: true, errors: [], warnings };
  } catch (e) {
    return { ok: false, errors: [(e as Error).message], warnings: [] };
  }
});
