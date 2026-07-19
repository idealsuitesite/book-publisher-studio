import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Frontend test harness (Sprint 9 Commit 2, UI_FOUNDATION.md Decision 6, ADR-0040 Correction 1).
 *
 * Vitest is pinned to the same major the backend already uses, so the monorepo keeps one test
 * runner rather than two toolchains to learn and maintain.
 *
 * This commit ships the HARNESS ONLY - configuration plus one smoke test proving the runner
 * actually executes. It is deliberately not a test suite: the `ui/` primitives it would cover
 * do not exist until Commit 3, so a suite written here would be tested against components that
 * do not yet exist. Every commit from 3 onward ships its own tests inline instead, which is
 * what all 8 prior sprints did (Sprint 8's implementation commits carried 1, 6, 1, 1 and 2 test
 * files respectively; this project has never had a standalone unit-test commit).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Scoped to source: without this, Vitest walks node_modules and the Playwright baseline
    // tooling, neither of which contains unit tests.
    include: ['{app,components,lib}/**/*.{test,spec}.{ts,tsx}'],
    css: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
