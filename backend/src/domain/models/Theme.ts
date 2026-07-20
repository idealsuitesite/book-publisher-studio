import type { Book } from './Book';
import type { ResolvedTypography } from './ResolvedTypography';

// Sprint 6 (Professional Layout Engine), ADR-0029 Decision 2: header/footer presentation is a
// theme decision, same category as fonts/colors/spacing - deliberately more detailed than a
// single on/off flag so future themes (Minimal, Academic, Novel, a Bible/Theology-oriented
// theme) can each present a genuinely different running head without any LayoutEngine change.
// Only ClassicTheme populates this in Sprint 6 (see ClassicTheme.ts) - the other fields have no
// consumer variety to validate the shape against yet (ADR-0029 Risk 5, disclosed not hidden).
export interface RunningHead {
  show: boolean;
  position: 'left' | 'right';
  content: 'bookTitle' | 'chapterTitle';
  pageNumber: boolean;
  separator?: string;
  uppercase: boolean;
  font?: string;
  size?: number;
}

/**
 * Declared block presentation (BOOK_PRESENTATION.md §4.2, Phase 3): ONE source of truth for
 * what used to be three per-renderer magic values that disagreed in kind as well as number —
 * PDF drew a FIRST-LINE indent of 36pt, DOCX a true block indent of 36pt (720 twips), EPUB a
 * 1.5em margin. Renderers consume this; the pagination model prices quote text at the
 * narrowed column (R2, the height contract). Absent presentation falls back to the historical
 * constants so a theme without it keeps rendering.
 */
export interface QuotePresentation {
  /** Uniform left inset of quote/scripture blocks, in points — all lines, every format. */
  indentPt: number;
}

export interface BlockPresentation {
  quote: QuotePresentation;
}

export interface Theme {
  name: string;
  fonts: {
    heading: string;
    body: string;
  };
  fontSizes: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
    body: number;
    small: number;
  };
  colors: {
    text: string;
    accent: string;
  };
  spacing: {
    paragraphSpacing: number;
    headingSpacing: number;
    lineHeight: number;
  };
  // Additive (ADR-0022/ADR-0027 pattern) - no existing Theme consumer breaks. undefined/show:false
  // means no running head at all, matching every theme's behavior before this sprint.
  runningHead?: RunningHead;
  // Additive, same pattern (Phase 3, BOOK_PRESENTATION.md): block dress declared here,
  // consumed by all three renderers AND priced by the layout model.
  presentation?: BlockPresentation;
}

export interface ResolvedBlockStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  spaceBefore: number;
  spaceAfter: number;
}

export interface StyledBook {
  book: Book;
  theme: Theme;
  blockStyles: Record<string, ResolvedBlockStyle>;
  // Populated by TypographyResolver (Sprint 4) - additive, optional so existing
  // StyledBook producers/consumers stay unaffected until they opt in.
  blockTypography?: Record<string, ResolvedTypography>;
}
