import type { Theme } from '../models/Theme';

// The second Book Presentation theme (SECOND_THEME.md, CTO-approved direction "Modern",
// 2026-07-21). The defining differences from Classic, deliberately the ones an author notices:
//  - SANS-serif headings over a serif body (Classic is serif throughout). 'Helvetica' is the
//    logical heading name: PdfFontRegistry maps it to the embedded Inter face (same logical-name
//    pattern as Classic's 'Georgia' -> Gelasio), while DOCX/EPUB name a real sans face.
//  - A VISIBLE accent (Prussian blue) on headings and chapter/section titles. This is the point of
//    the choice: Classic sets accent === text (#000000) deliberately, so colors.accent -- made a
//    real tri-format consumed value in Phase 3 -- is exercised end to end ONLY by a synthetic test
//    theme until a real theme uses it. Modern is that real theme.
//
// The exact accent shade is a SCREENSHOT-LOOP decision (VISUAL_LANGUAGE §9), not a blind pick:
// #1D4E68 is the Prussian-blue starting point (the value the accentColors parity test already
// uses), to be judged on real pages and tuned there -- see SECOND_THEME.md §4 and the commit plan
// stop at step 3. Body stays Georgia/Gelasio (a plain serif reading face), sizes match Classic;
// heading spacing is slightly tighter, the one rhythm difference of the "Modern" direction.
export const ModernTheme: Theme = {
  name: 'modern',
  fonts: {
    heading: 'Helvetica', // -> embedded Inter in PDF; a real sans face in DOCX/EPUB
    body: 'Georgia', // -> embedded Gelasio in PDF; Georgia in DOCX/EPUB (same as Classic's body)
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
    accent: '#1D4E68', // VISIBLE (accent !== text) -- the defining difference; exercises colors.accent
  },
  spacing: {
    paragraphSpacing: 8,
    headingSpacing: 12, // slightly tighter than Classic's 16 -- the "Modern" rhythm
    lineHeight: 1.4,
    titleSpaceBefore: 14, // tighter than Classic (18/8), matching Modern's rhythm
    titleSpaceAfter: 6,
  },
  // scope 'none' — same mandate as Classic (MINI_DR_DROP_CAPS §3 instrument 3): Modern's own
  // parity/calibration numbers must not move; adopting drop caps is a screenshot-loop decision.
  presentation: {
    dropCap: { scope: 'none', scale: 2.5 },
  },
  runningHead: {
    show: true,
    position: 'right',
    content: 'bookTitle',
    pageNumber: true,
    uppercase: false,
    size: 9,
  },
};
