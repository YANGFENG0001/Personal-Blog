import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import preact from '@astrojs/preact';

export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 12 * 1024 * 1024 }),
  integrations: [preact()],
  build: { inlineStylesheets: 'never' },
  security: {
    // Origin + CSRF-token checks are enforced in src/middleware.ts for every
    // state-changing owner/auth request (works behind a reverse proxy too).
    checkOrigin: false,
    // Astro hashes its own inline scripts/styles and emits the policy per page.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' https: data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      styleDirective: {
        resources: ["'self'", { resource: "'self'", kind: 'element' }, { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
      scriptDirective: { resources: ["'self'"] },
    },
  },
  vite: { ssr: { external: ['better-sqlite3'] } },
});
