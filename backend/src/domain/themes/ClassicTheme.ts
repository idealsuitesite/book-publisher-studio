import type { Theme } from '../models/Theme';

export const ClassicTheme: Theme = {
  name: 'classic',
  fonts: {
    heading: 'Georgia',
    body: 'Georgia',
  },
  fontSizes: {
    h1: 28,
    h2: 22,
    h3: 18,
    h4: 16,
    h5: 14,
    h6: 12,
    body: 11,
    small: 9,
  },
  colors: {
    text: '#000000',
    // Phase 3 capability 1: now that `accent` is really consumed (headings + chapter titles, all
    // three renderers), Classic declares its accent to BE its text colour. That is an honest
    // statement about a plain classic book, not a placeholder — and it keeps the shipped theme
    // byte-stable, because whether Classic ever adopts a VISIBLE accent is an aspect decision
    // the CTO reserved for the second theme's screenshot loop. Do not anticipate it here.
    // (The previous '#4A4A4A' had zero consumers — verified — so nothing regresses.)
    accent: '#000000',
  },
  spacing: {
    paragraphSpacing: 8,
    headingSpacing: 16,
    lineHeight: 1.4,
    titleSpaceBefore: 18, // above > below (convention). Effective above ~= 8 (prev block's
    titleSpaceAfter: 8, //   paragraphSpacing bleeds down) + 18 = ~26pt, vs 8pt below.
  },
  // scope 'none' — MANDATED (MINI_DR_DROP_CAPS §3 instrument 3): the shipped theme grows no
  // drop caps, so the corpus parity numbers cannot move; whether Classic ever adopts them is an
  // aspect decision reserved for the screenshot loop (the accent-colour precedent). The scale
  // is the value the deprecated per-block path already renders at (dropCapMetrics fallback) —
  // declaring it changes no byte.
  presentation: {
    dropCap: { scope: 'none', scale: 2.5 },
  },
  // Matches today's pre-Sprint-6 PDF running-head/footer defaults (top running head, "Page N
  // of TOTAL" footer, size-9 default font) minus the hardcoded 'Book Publisher Studio' literal
  // it's replacing (ADR-0029 Decision 6) - content is now the book's real title.
  runningHead: {
    show: true,
    position: 'right',
    content: 'bookTitle',
    pageNumber: true,
    uppercase: false,
    size: 9,
  },
};
