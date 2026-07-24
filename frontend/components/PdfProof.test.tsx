import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';

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

// Mutable so a test can choose the page count (the window-policy test needs several pages) and observe
// the SCALE the text layer is built at (the zoom test asserts the text layer scales with the viewport).
const mockState: { numPages: number; textLayerScales: number[] } = { numPages: 1, textLayerScales: [] };

vi.mock('pdfjs-dist', () => {
  class FakeTextLayer {
    private container: HTMLElement;
    private source: { items: Array<{ str: string }> };
    constructor({ container, textContentSource, viewport }: { container: HTMLElement; textContentSource: { items: Array<{ str: string }> }; viewport: { scale: number } }) {
      this.container = container;
      this.source = textContentSource;
      // Record the scale the standard text layer is laid out at — it must track the viewport (and thus zoom).
      mockState.textLayerScales.push(viewport.scale);
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
  mockState.textLayerScales = [];
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

  it('preserves the scroll position across a re-ink (continuity of the gaze, D2)', async () => {
    mockState.numPages = 6;
    const { container, rerender } = render(<PdfProof bytes={new ArrayBuffer(16)} />);
    const scrollEl = container.querySelector('.pdfProofScroll') as HTMLElement;
    // jsdom does not lay out, so give the container a real, settable scrollTop to stand in for scroll.
    let scrollTopValue = 0;
    Object.defineProperty(scrollEl, 'scrollTop', {
      configurable: true,
      get: () => scrollTopValue,
      set: (v: number) => { scrollTopValue = v; },
    });
    await waitFor(() => expect(container.querySelectorAll('.pdfPage').length).toBe(6));

    // The author scrolls, then an edit re-inks with fresh bytes.
    scrollEl.scrollTop = 240;
    rerender(<PdfProof bytes={new ArrayBuffer(24)} />);

    // After the re-ink the gaze is where it was — the surface did not jump to the top (the whole-<embed>
    // reswap's defect this chantier removes).
    await waitFor(() => expect(scrollEl.scrollTop).toBe(240));
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

  it('re-paints at a new scale on zoom, and the text layer scales with the viewport (commit 7)', async () => {
    const { container, getByLabelText } = render(<PdfProof bytes={new ArrayBuffer(16)} />);
    await waitFor(() => expect(mockState.textLayerScales.length).toBeGreaterThan(0));

    // Fit-width in this stub (clientWidth 600, page width 600) is scale 1 = 100%.
    const initialScale = mockState.textLayerScales.at(-1)!;
    expect(initialScale).toBe(1);
    expect(container.querySelector('.pdfProofZoomLevel')?.textContent).toBe('100%');

    mockState.textLayerScales = [];
    fireEvent.click(getByLabelText('Zoom out')); // 1.0 → 0.75

    await waitFor(() => expect(mockState.textLayerScales.length).toBeGreaterThan(0));
    const zoomedScale = mockState.textLayerScales.at(-1)!;
    // The page re-painted at a SMALLER scale, and the standard text layer was laid out at that same
    // scale (so selection stays aligned over the canvas at any zoom).
    expect(zoomedScale).toBeCloseTo(0.75, 5);
    expect(container.querySelector('.pdfProofZoomLevel')?.textContent).toBe('75%');
  });

  it('reduces below fit-width for a capture view and clamps at the floor (commit 7)', async () => {
    const { getByLabelText, container } = render(<PdfProof bytes={new ArrayBuffer(16)} />);
    await waitFor(() => expect(container.querySelector('.textLayer')).not.toBeNull());
    const zoomOut = getByLabelText('Zoom out') as HTMLButtonElement;
    // Drive it down to the floor: 1.0 → 0.75 → 0.5 → 0.25, then it disables (a reduced, capture-friendly view).
    for (let i = 0; i < 6; i++) fireEvent.click(zoomOut);
    await waitFor(() => expect(container.querySelector('.pdfProofZoomLevel')?.textContent).toBe('25%'));
    expect(zoomOut.disabled).toBe(true);
  });

  it('moves the scroll anchor PROPORTIONALLY across a zoom change (commit 7)', async () => {
    const { container, getByLabelText } = render(<PdfProof bytes={new ArrayBuffer(16)} />);
    const scrollEl = container.querySelector('.pdfProofScroll') as HTMLElement;
    let scrollTopValue = 0;
    Object.defineProperty(scrollEl, 'scrollTop', {
      configurable: true,
      get: () => scrollTopValue,
      set: (v: number) => { scrollTopValue = v; },
    });
    await waitFor(() => expect(mockState.textLayerScales.length).toBeGreaterThan(0));

    scrollEl.scrollTop = 200; // the author is reading here at 100%
    mockState.textLayerScales = [];
    fireEvent.click(getByLabelText('Zoom out')); // 1.0 → 0.75

    // The same content point stays under the eye: scrollTop scales by the same ratio (200 × 0.75 = 150).
    await waitFor(() => expect(mockState.textLayerScales.at(-1)).toBeCloseTo(0.75, 5));
    await waitFor(() => expect(scrollEl.scrollTop).toBeCloseTo(150, 5));
  });
});
