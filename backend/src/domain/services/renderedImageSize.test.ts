import { describe, it, expect } from 'vitest';
import { renderedImageSize } from './renderedImageSize';

// R2, the height contract (BOOK_PRESENTATION.md §3 / ADR-0051's corollary): this is THE
// formula both the pagination model and the renderers share for images — tested here once,
// consumed everywhere, so priced height and drawn height cannot drift apart.
describe('renderedImageSize (R2)', () => {
  it('scales a too-wide image down to the column, preserving aspect', () => {
    expect(renderedImageSize({ width: 400, height: 200 }, 300)).toEqual({ width: 300, height: 150 });
  });

  it('never upscales an image that already fits', () => {
    expect(renderedImageSize({ width: 100, height: 80 }, 300)).toEqual({ width: 100, height: 80 });
  });

  it('refuses to invent a size when dimensions are missing or degenerate', () => {
    expect(renderedImageSize({ width: undefined, height: 200 }, 300)).toBeUndefined();
    expect(renderedImageSize({ width: 400, height: undefined }, 300)).toBeUndefined();
    expect(renderedImageSize({ width: 0, height: 200 }, 300)).toBeUndefined();
  });
});
