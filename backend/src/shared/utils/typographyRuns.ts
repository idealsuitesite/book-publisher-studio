import type { ResolvedTypography, TypeRun } from '../../domain/models/ResolvedTypography';

/**
 * blockTypography is populated by TypographyResolver, but stays optional on StyledBook
 * (Sprint 4 commit 1) so any caller that hasn't run it yet (or a hand-built test fixture)
 * still renders the block's plain text, unstyled. Shared across renderers (PDFRenderer,
 * DOCXRenderer, EPUBRenderer) rather than reimplemented per renderer.
 */
export function plainTypeRun(text: string): TypeRun {
  return {
    text,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    smallCaps: false,
  };
}

export function runsOrPlainFallback(entry: ResolvedTypography | undefined, fallbackText: string): TypeRun[] {
  return entry && entry.runs.length > 0 ? entry.runs : [plainTypeRun(fallbackText)];
}
