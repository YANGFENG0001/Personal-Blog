import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicOrigin } from '../../src/lib/origin';

const SITE = new URL('http://localhost:4321/');
const REQUEST = new URL('http://127.0.0.1:4321/archive');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('publicOrigin', () => {
  it('prefers the runtime SITE_URL over the build-time site', () => {
    // The deployed image bakes `http://localhost:4321` into `site`; only the
    // container env knows the real domain.
    vi.stubEnv('SITE_URL', 'https://blog.example.com');
    expect(publicOrigin(SITE, REQUEST).href).toBe('https://blog.example.com/');
  });

  it('tolerates surrounding whitespace', () => {
    vi.stubEnv('SITE_URL', '  https://blog.example.com  ');
    expect(publicOrigin(SITE, REQUEST).origin).toBe('https://blog.example.com');
  });

  it('falls back to the build-time site when SITE_URL is absent', () => {
    vi.stubEnv('SITE_URL', '');
    expect(publicOrigin(SITE, REQUEST).href).toBe('http://localhost:4321/');
  });

  it('falls back to the request URL when there is no site either', () => {
    vi.stubEnv('SITE_URL', '');
    expect(publicOrigin(undefined, REQUEST).href).toBe('http://127.0.0.1:4321/archive');
  });

  it('ignores a malformed SITE_URL instead of throwing', () => {
    vi.stubEnv('SITE_URL', 'blog.example.com'); // no scheme
    expect(publicOrigin(SITE, REQUEST).href).toBe('http://localhost:4321/');
  });
});
