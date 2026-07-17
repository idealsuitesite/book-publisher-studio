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
    accent: '#4A4A4A',
  },
  spacing: {
    paragraphSpacing: 8,
    headingSpacing: 16,
    lineHeight: 1.4,
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
