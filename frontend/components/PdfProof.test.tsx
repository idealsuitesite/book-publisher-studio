import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

/**
 * INCREMENTAL_RENDER (P1, commit 4) — the ACCESSIBILITY gate (DR §3 point 4, "a test, not a note"):
 * the PDF.js Proof surface renders the standard text layer so the page's text is SELECTABLE and exposed
 * to screen readers — a canvas alone would render the book mute. pdfjs-dist is mocked here (its real
 * canvas/worker rendering is not exercisable in jsdom, and its correctness is pdfjs's own concern; the
 * fidelity of the PAINTED bytes is proven by the backend byte-invariant and the browser taste-stop).
 * What this test pins is OUR wiring: we feed each page's getTextContent into the standard TextLayer and
 * mount that text, real and selectable, over the canvas.
 */

const PAGE_TEXT = 'Justification stands at the very center of the gospel message.';

// Mutable so a test can choose the page count (the window-policy test needs several pages).
const mockState = { numPages: 1 };

vi.mock('pdfjs-dist', () => {
  class FakeTextLayer {
    private container: HTMLElement;
    private source: { items: Array<{ str: string }> };
    constructor({ container, textContentSource }: { container: HTMLElement; textContentSource: { items: Array<{ str: string }> } }) {
      this.container = container;
      this.source = textContentSource;
    }
    render(): Promise<void> {
      // The real TextLayer builds absolutely-positioned, user-selectable spans from the text items;
      // the mock reproduces exactly that observable shape (spans carrying the text), nothing more.
      for (const item of this.source.items) {
        const span = document.createElement('span');
        span.textContent = item.str;
        this.container.append(span);
      }
      return Promise.resolve();
    }
  }
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale, scale }),
    render: () => ({ promise: Promise.resolve() }),
    getTextContent: () => Promise.resolve({ items: [{ str: PAGE_TEXT }] }),
  };
  const doc = {
    get numPages() {
      return mockState.numPages;
    },
    getPage: () => Promise.resolve(page),
    destroy: () => Promise.resolve(),
  };
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () => ({ promise: Promise.resolve(doc), destroy: () => undefined }),
    setLayerDimensions: vi.fn(),
    TextLayer: FakeTextLayer,
  };
});

import { PdfProof } from './PdfProof';

beforeEach(() => {
  mockState.numPages = 1;
  // A container width so the fit-to-width scale is well-defined (jsdom reports 0 otherwise).
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
});

describe('PdfProof — the PDF.js canvas surface', () => {
  it('renders a SELECTABLE, screen-reader-exposed text layer over the page (the a11y gate)', async () => {
    const { container } = render(<PdfProof bytes={new ArrayBuffer(16)} />);

    // The text layer is built and mounted with the page's real text.
    const textLayer = await waitFor(() => {
      const el = container.querySelector('.textLayer');
      if (!el || !el.textContent?.includes('Justification')) throw new Error('text layer not ready');
      return el as HTMLElement;
    });

    // Screen-reader exposure: the text is real DOM text, not aria-hidden, not a canvas bitmap.
    expect(textLayer.getAttribute('aria-hidden')).not.toBe('true');
    expect(textLayer.textContent).toContain(PAGE_TEXT);
    // Selectable: the text lives in spans (the CSS gives them user-select:text over the canvas).
    expect(textLayer.querySelectorAll('span').length).toBeGreaterThan(0);
  });

  it('renders nothing until it is given bytes (no crash on an empty proof)', () => {
    const { container } = render(<PdfProof bytes={null} />);
    expect(container.querySelector('.textLayer')).toBeNull();
  });

  it('renders only the visible window eagerly and defers the rest to scroll (window policy, D3)', async () => {
    mockState.numPages = 8;
    // A stub IntersectionObserver that RECORDS what is observed but never fires — so only the eager
    // window paints, and the deferred pages are the ones handed to render-on-scroll.
    const observed: Element[] = [];
    class StubIO {
      observe(el: Element) { observed.push(el); }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', StubIO as unknown as typeof IntersectionObserver);
    try {
      const { container } = render(<PdfProof bytes={new ArrayBuffer(16)} />);

      // The eager window paints (visible page ± 1). It must be MORE than zero and FEWER than all 8 —
      // a proof that the window is bounded, not "render everything".
      await waitFor(() => {
        const painted = container.querySelectorAll('.pdfPage .textLayer').length;
        if (painted === 0) throw new Error('eager window not painted yet');
      });
      const slots = container.querySelectorAll('.pdfPage');
      const painted = container.querySelectorAll('.pdfPage .textLayer').length;
      expect(slots).toHaveLength(8);
      expect(painted).toBeGreaterThan(0);
      expect(painted).toBeLessThan(8);
      // Every page NOT in the eager window was handed to the observer for render-on-scroll.
      expect(painted + observed.length).toBe(8);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
