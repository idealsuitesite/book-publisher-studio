import { describe, it, expect, vi } from 'vitest';
import { resolveAllowedOrigins, buildCorsOptions } from './corsOptions';

function check(options: ReturnType<typeof buildCorsOptions>, origin: string | undefined) {
  const callback = vi.fn();
  const originFn = options.origin as (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => void;
  originFn(origin, callback);
  return callback.mock.calls[0];
}

describe('resolveAllowedOrigins', () => {
  it('defaults to local development origins when nothing is configured', () => {
    expect(resolveAllowedOrigins({})).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('reads a comma-separated ALLOWED_ORIGINS', () => {
    expect(resolveAllowedOrigins({ ALLOWED_ORIGINS: 'https://a.com,https://b.com' })).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('trims whitespace around configured origins', () => {
    expect(resolveAllowedOrigins({ ALLOWED_ORIGINS: ' https://a.com , https://b.com ' })).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('falls back to the defaults when ALLOWED_ORIGINS is empty rather than allowing nothing', () => {
    expect(resolveAllowedOrigins({ ALLOWED_ORIGINS: '' })).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });
});

describe('buildCorsOptions', () => {
  const options = buildCorsOptions(['https://app.example.com']);

  it('allows a configured origin', () => {
    const [error, allowed] = check(options, 'https://app.example.com');
    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it('rejects an origin that is not configured — the hole a bare cors() left open', () => {
    const [error] = check(options, 'https://evil.example.com');
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('evil.example.com');
  });

  it('allows requests with no Origin, so curl and the verify-* tooling still work', () => {
    const [error, allowed] = check(options, undefined);
    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it('exposes only the methods this API actually serves', () => {
    expect(options.methods).toEqual(['GET', 'POST', 'PATCH']);
  });
});
