import type { CorsOptions } from 'cors';

/**
 * Restricts which browser origins may call this API.
 *
 * Previously the app used a bare `cors()`, which reflects any Origin and allows every website
 * on the internet to call this API from a visitor's browser. Harmless while nothing is
 * persisted and nothing is authenticated, but Sprints 15-16 (Cloud Sync, Licensing) make that
 * a real breach, and a permissive default that nobody revisits is exactly how it ships.
 *
 * Configured through ALLOWED_ORIGINS (comma-separated) so a deployment sets its own without a
 * code change. The defaults cover local development only.
 *
 * Requests with no Origin header are allowed: that is server-to-server traffic, curl, and this
 * project's own verify-server / verify-real-export / verify-real-publish tooling. The
 * same-origin policy does not apply to those, so rejecting them would break real workflows
 * without closing any browser-facing hole.
 */
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

export function buildCorsOptions(allowedOrigins: string[] = resolveAllowedOrigins()): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST'],
  };
}
