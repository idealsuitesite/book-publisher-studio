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
 * The theme-declared drop-cap rule (MINI_DR_DROP_CAPS §6 commit 2).
 *
 * `scope` is the POSITIONAL trigger (§2/Q1: positional, never inferential):
 * 'chapterOpening' puts a drop cap on a chapter's first block iff that block is a paragraph
 * with real text — a chapter opening with a heading/quote/image has no opening paragraph to
 * ornament, text under sections is a section opening (the rule never descends), and an empty
 * chapter (including the blockless part-opener divider) fires nothing. 'none' grows no drop
 * caps; the deprecated per-block `Block.dropCap` path (DECISIONS.md) still renders if set.
 *
 * `scale` is the ONE declared geometry knob: the glyph is drawn at scale × body size, and the
 * band it spans — Word's `w:lines`, the PDF's indented lines — is DERIVED from measured font
 * metrics through the shared `dropCapMetrics` arithmetic. The band (`lines`) is deliberately
 * NOT a second declared field: two independent knobs could disagree, and the one declared
 * value would then mean different geometry in different formats — the exact §4bis divergence
 * class this capability exists to close. (Commit 1's proof is the model: Word read back
 * LinesToDrop=2 == the PDF's Gelasio band — DERIVED equality, never declared twice.)
 */
export interface DropCapPresentation {
  scope: 'none' | 'chapterOpening';
  scale: number;
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
    // Chapter/Section TITLE spacing (MINI_DR_SUBTITLE_SPACING). Flat points, size-independent,
    // and deliberately ASYMMETRIC (above > below) so a title binds to the text it introduces.
    // Distinct from headingSpacing (which spaces heading *blocks* symmetrically): real DOCX
    // imports produce Chapter/Section titles, not heading blocks (ADR-0031/0032), so before this
    // the PDF spaced all titles with renderTitle's size-scaled moveDown() -- below-only, backwards.
    // PDF-only for now (DOCXRenderer/EPUBRenderer do not read these; tri-format convergence is a
    // named candidate for the per-theme fine-tuning chantier).
    titleSpaceBefore: number;
    titleSpaceAfter: number;
  };
  // Additive (ADR-0022/ADR-0027 pattern) - no existing Theme consumer breaks. undefined/show:false
  // means no running head at all, matching every theme's behavior before this sprint.
  runningHead?: RunningHead;
  // Block-presentation rules the theme declares (BOOK_PRESENTATION §6 Q2: presentation lives in
  // Theme, never as per-block AST overrides). Additive and optional — a theme without it
  // presents exactly as before the capability existed.
  presentation?: {
    dropCap?: DropCapPresentation;
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
