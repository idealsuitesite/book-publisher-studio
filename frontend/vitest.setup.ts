import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Unmounts anything a test rendered. Without this, jsdom keeps every previously-rendered tree
 * in the document, so a query like getByRole('button') starts matching leftovers from an
 * earlier test and failures become order-dependent - the hardest kind to diagnose.
 */
afterEach(() => {
  cleanup();
});
