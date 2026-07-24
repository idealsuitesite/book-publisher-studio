import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    // A few integration tests render a real PDF of the corpus book (pagination + PDFKit + font
    // embedding) — legitimately ~2–6s each. Under the full suite's parallel load they can brush past
    // vitest's 5s default and flake by TIMEOUT (not assertion). 20s gives real headroom; it changes
    // nothing for the fast unit tests (they finish in ms). (INCREMENTAL_RENDER post-merge hygiene.)
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utils/**', 'src/index.ts', 'src/services/**'],
    },
  },
});
