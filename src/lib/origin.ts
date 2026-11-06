/**
 * The public origin of this deployment — the base every absolute URL is built on
 * (canonical links, `og:url`, sitemap `<loc>`, RSS `<link>`).
 *
 * `Astro.site` comes from `astro.config.mjs`, and that file is evaluated at
 * **build** time. The production image is built in CI, where `.env` does not
 * exist (`.dockerignore` keeps it out), so `site` collapses to the config
 * default `http://localhost:4321` — and that string is what shipped in every
 * canonical tag of the deployed site.
 *
 * Resolving at request time fixes it without a rebuild per environment: the
 * runtime `SITE_URL` (docker `env_file: .env`) wins, then the build-time `site`,
 * then the request URL. A malformed value must never take the site down, so it
 * is ignored with one warning.
 */
export function publicOrigin(site: URL | undefined, url: URL): URL {
  const raw = readEnv('SITE_URL');
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      warnOnce(`[origin] ignoring invalid SITE_URL: ${raw}`);
    }
  }
  return site ?? url;
}

function readEnv(name: string): string | undefined {
  // `process` is absent when a module is pulled into a client bundle by accident.
  const raw = typeof process === 'undefined' ? undefined : process.env[name];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}
