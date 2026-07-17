import type { Book } from './Book';
import type { ResolvedTypography } from './ResolvedTypography';

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
