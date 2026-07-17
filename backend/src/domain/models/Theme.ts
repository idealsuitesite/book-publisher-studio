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
