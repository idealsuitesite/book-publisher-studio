'use client';

import { useEffect, useRef, useState } from 'react';
import './pdf-proof.css';

/**
 * INCREMENTAL_RENDER (P1, commit 4) — the PDF.js canvas Proof surface, replacing the whole-`<embed>`
 * reswap (INCREMENTAL_RENDER_DR §D2). It paints the REAL PDF's pages to canvases the app owns, so an
 * edit repaints in place and the author's scroll position is PRESERVED — continuity of the gaze is
 * criterion A itself, not a cosmetic nicety. It is NOT a divergent preview artifact (the feared V3): it
 * paints the bytes of the real render, page-wise.
 *
 * Design commitments the DR fixed here:
 *  • The standard TEXT LAYER (pdfjs `TextLayer` + `setLayerDimensions`) is rendered over each canvas, so
 *    the page's text is SELECTABLE and exposed to screen readers — a canvas alone would render the book
 *    mute (the commit-4 accessibility gate, asserted by test). It scales WITH the viewport, so it stays
 *    aligned at any zoom.
 *  • Pages render LAZILY (an IntersectionObserver paints a page only as it nears the viewport), so a
 *    352-page book does not freeze the UI eagerly. Which pages to FETCH (the region window) is commit 5.
 *  • ZOOM (commit 7 — the founder taste-stop regression: the native viewer's zoom was gone). Fit-width,
 *    +/−, and a reduced view for screen captures. `scale` is already a PDF.js render parameter, so a zoom
 *    change re-renders the window at the new scale and restores the scroll anchor PROPORTIONALLY (the
 *    same content point stays under the eye). The 500 ms debounce and the window policy are untouched.
 */

type Pdfjs = typeof import('pdfjs-dist');

// The eager render window (INCREMENTAL_RENDER_DR §D3): the visible page plus this many neighbours each
// side are painted immediately; the rest render on scroll. A measured, revisable size — one neighbour
// keeps a short scroll already drawn without eagerly painting a whole book.
const WINDOW_NEIGHBOURS = 1;
// Must match the `gap` between pages in pdf-proof.css (.pdfProofPages) so the visible-window maths lines up.
const PAGE_GAP_PX = 16;

// Zoom (commit 7): a multiplier over fit-width (1 = fit-width = 100%). MIN low enough for a reduced,
// capture-friendly view; MAX for reading fine detail; a plain additive step so the values are predictable.
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

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
  // The effective scale (fit-width × zoom) actually rendered last, so a zoom change can restore the
  // scroll anchor proportionally rather than verbatim.
  const renderedScaleRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!bytes) return;
    const token = ++tokenRef.current;
    const scrollEl = scrollRef.current;
    const pagesEl = pagesRef.current;
    if (!scrollEl || !pagesEl) return;

    const previousScrollTop = scrollEl.scrollTop; // preserve the gaze across the re-ink / re-scale
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
      // page still renders at its OWN viewport so a stray odd-sized page is correct once painted. Zoom
      // multiplies the fit-width scale (commit 7).
      const first = await doc.getPage(1);
      const unscaled = first.getViewport({ scale: 1 });
      const fitWidth = scrollEl.clientWidth || 600;
      const scale = (fitWidth / unscaled.width) * zoom;

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
      // One swap of the whole page list, then restore scroll — no intermediate blank state. On a re-ink
      // at the same scale the anchor is verbatim; on a zoom change it moves PROPORTIONALLY so the same
      // content point stays under the eye (ratio = new scale ÷ last rendered scale).
      pagesEl.replaceChildren(frag);
      const prevScale = renderedScaleRef.current;
      const ratio = prevScale && prevScale > 0 ? scale / prevScale : 1;
      scrollEl.scrollTop = previousScrollTop * ratio;
      renderedScaleRef.current = scale;

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
        // It is built from the SAME viewport as the canvas, so it scales with zoom and stays aligned.
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

      // WINDOW POLICY (INCREMENTAL_RENDER_DR §D3): render the visible page ± a small neighbour window
      // EAGERLY (so the first paint is instant and a short scroll is already drawn), then render-on-scroll
      // for everything beyond. The window is spent by decision, not drift — a fixed, revisable size.
      const pageStride = unscaled.height * scale + PAGE_GAP_PX;
      const anchorScrollTop = scrollEl.scrollTop; // after the proportional restore above
      const viewportH = scrollEl.clientHeight || pageStride;
      const firstVisible = Math.max(0, Math.floor(anchorScrollTop / pageStride));
      const lastVisible = Math.min(slots.length - 1, Math.ceil((anchorScrollTop + viewportH) / pageStride));
      const eagerStart = Math.max(0, firstVisible - WINDOW_NEIGHBOURS);
      const eagerEnd = Math.min(slots.length - 1, lastVisible + WINDOW_NEIGHBOURS);
      for (let i = eagerStart; i <= eagerEnd && !isStale(); i++) await renderPage(i + 1, slots[i]);

      // Render-on-scroll for the rest: a page paints as it nears view (rootMargin one screen of
      // look-ahead so scrolling stays ahead of the paint). Without IntersectionObserver (jsdom in
      // tests) the eager window above is the whole render — a book with more pages simply renders its
      // in-view window, which is exactly what the policy asks.
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
        slots.forEach((slot, i) => {
          if (i < eagerStart || i > eagerEnd) io.observe(slot); // the eager window is already painted
        });
        cleanups.push(() => io.disconnect());
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((clean) => clean());
    };
  }, [bytes, zoom]);

  return (
    <div className={`pdfProofRoot ${className}`}>
      {/* Zoom controls (commit 7) — minimal, not a toolbar: fit-width, out, in, and the current level. */}
      <div className="pdfProofControls" role="toolbar" aria-label="Proof zoom">
        <button type="button" aria-label="Fit width" onClick={() => setZoom(1)}>
          Fit
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
        >
          −
        </button>
        <span className="pdfProofZoomLevel" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
        >
          +
        </button>
      </div>
      <div
        ref={scrollRef}
        aria-label={ariaLabel}
        role="document"
        // Masked in the visual-baseline capture: the canvas paint is non-deterministic across runs
        // (font hinting/antialiasing), the same reason the old <embed> carried this attribute.
        data-baseline-mask
        className={`pdfProofScroll transition-opacity duration-[var(--motion-view)] ${
          refreshing ? 'opacity-40' : 'opacity-100'
        }`}
      >
        <div ref={pagesRef} className="pdfProofPages" />
      </div>
    </div>
  );
}
