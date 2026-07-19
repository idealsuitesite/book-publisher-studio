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

/**
 * jsdom gaps Radix's floating components genuinely require (Sprint 9 Commit 4). Each is a
 * browser API jsdom simply does not implement — stubbing them changes nothing about what the
 * tests assert, it only lets the components mount at all.
 */
if (typeof window !== 'undefined') {
  // Popper-positioned components (Popover, Menu, Tooltip) observe their anchor's size.
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // Radix guards pointer interactions behind the pointer-capture API.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  // jsdom has no layout, so anchored positioning reads all-zero rects - fine for behaviour tests.
  Element.prototype.scrollIntoView ??= () => {};
}
