'use client';

import { useEffect, useRef } from 'react';
import './pdf-proof.css';

/**
 * INCREMENTAL_RENDER (P1, commit 4) — the PDF.js canvas Proof surface, replacing the whole-`<embed>`
 * reswap (INCREMENTAL_RENDER_DR §D2). It paints the REAL PDF's pages to canvases the app owns, so an
 * edit repaints in place and the author's scroll position is PRESERVED — continuity of the gaze is
 * criterion A itself, not a cosmetic nicety. It is NOT a divergent preview artifact (the feared V3): it
 * paints the bytes of the real render, page-wise.
 *
 * Two design commitments the DR fixed here:
 *  • The standard TEXT LAYER (pdfjs `TextLayer` + `setLayerDimensions`) is rendered over each canvas, so
 *    the page's text is SELECTABLE and exposed to screen readers — a canvas alone would render the book
 *    mute (the commit-4 accessibility gate, asserted by test).
 *  • Pages render LAZILY (an IntersectionObserver paints a page only as it nears the viewport), so a
 *    352-page book does not freeze the UI eagerly. Which pages to FETCH (the region window) is commit 5.
 */

type Pdfjs = typeof import('pdfjs-dist');

// Load pdfjs and its worker once, lazily, on the client only (it touches DOM/canvas). The worker URL is
// resolved through the bundler via `import.meta.url` — the standard bundler-friendly pdfjs pattern.
let pdfjsPromise: Promise<Pdfjs> | null = null;
function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

interface PdfProofProps {
  /** The PDF to display. A new buffer re-inks the surface, preserving the scroll position. */
  bytes: ArrayBuffer | null;
  /** Dim the surface while a fresh render is in flight (VISUAL_LANGUAGE §6 — re-ink, never a blank flash). */
  refreshing?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function PdfProof({ bytes, refreshing = false, className = '', ariaLabel = 'Book proof' }: PdfProofProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  // A monotonic token so a render that finishes after a newer one started is discarded — the proof
  // never goes backwards (the same guard the panel's living loop uses).
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!bytes) return;
    const token = ++tokenRef.current;
    const scrollEl = scrollRef.current;
    const pagesEl = pagesRef.current;
    if (!scrollEl || !pagesEl) return;

    const previousScrollTop = scrollEl.scrollTop; // preserve the gaze across the re-ink
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const isStale = () => cancelled || tokenRef.current !== token;

    void (async () => {
      const pdfjs = await loadPdfjs();
      if (isStale()) return;

      const task = pdfjs.getDocument({ data: bytes.slice(0) }); // slice: pdfjs detaches the buffer it is given
      cleanups.push(() => void task.destroy()); // tears down the document too
      const doc = await task.promise;
      if (isStale()) return;

      // Fit to the container width, sizing every page from the first (a book's pages are uniform); each
      // page still renders at its OWN viewport so a stray odd-sized page is correct once painted.
      const first = await doc.getPage(1);
      const unscaled = first.getViewport({ scale: 1 });
      const fitWidth = scrollEl.clientWidth || 600;
      const scale = fitWidth / unscaled.width;

      const slots: HTMLDivElement[] = [];
      const frag = document.createDocumentFragment();
      for (let n = 1; n <= doc.numPages; n++) {
        const slot = document.createElement('div');
        slot.className = 'pdfPage';
        slot.style.width = `${unscaled.width * scale}px`;
        slot.style.height = `${unscaled.height * scale}px`;
        slot.dataset.page = String(n);
        frag.append(slot);
        slots.push(slot);
      }
      // One swap of the whole page list, then restore scroll — no intermediate blank state.
      pagesEl.replaceChildren(frag);
      scrollEl.scrollTop = previousScrollTop;

      const renderPage = async (n: number, slot: HTMLDivElement): Promise<void> => {
        if (isStale() || slot.dataset.rendered) return;
        slot.dataset.rendered = '1';
        const page = await doc.getPage(n);
        if (isStale()) return;
        const viewport = page.getViewport({ scale });
        const outputScale = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

        const canvas = document.createElement('canvas');
        canvas.className = 'pdfCanvas';
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // v6 takes the canvas element itself (canvasContext is optional); the transform applies the
          // device-pixel-ratio upscale so the bitmap is crisp on hi-dpi displays.
          await page.render({
            canvas,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          }).promise;
          if (isStale()) return;
        }

        // The standard text layer, laid transparently over the canvas — selectable & screen-reader-exposed.
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        pdfjs.setLayerDimensions(textLayerDiv, viewport);
        const textLayer = new pdfjs.TextLayer({
          textContentSource: await page.getTextContent(),
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();
        if (isStale()) return;

        slot.replaceChildren(...(ctx ? [canvas, textLayerDiv] : [textLayerDiv]));
      };

      // Lazy paint: a page renders as it nears view. rootMargin one screen out so scrolling stays ahead
      // of the paint. Without IntersectionObserver (jsdom in tests), render every page synchronously.
      if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const slot = entry.target as HTMLDivElement;
              io.unobserve(slot);
              void renderPage(Number(slot.dataset.page), slot);
            }
          },
          { root: scrollEl, rootMargin: '100% 0px' }
        );
        slots.forEach((slot) => io.observe(slot));
        cleanups.push(() => io.disconnect());
      } else {
        for (let i = 0; i < slots.length && !isStale(); i++) await renderPage(i + 1, slots[i]);
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((clean) => clean());
    };
  }, [bytes]);

  return (
    <div
      ref={scrollRef}
      aria-label={ariaLabel}
      role="document"
      // Masked in the visual-baseline capture: the canvas paint is non-deterministic across runs
      // (font hinting/antialiasing), the same reason the old <embed> carried this attribute.
      data-baseline-mask
      className={`pdfProofScroll transition-opacity duration-[var(--motion-view)] ${
        refreshing ? 'opacity-40' : 'opacity-100'
      } ${className}`}
    >
      <div ref={pagesRef} className="pdfProofPages" />
    </div>
  );
}
