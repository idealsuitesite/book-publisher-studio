import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolves ADR-0019 finding 1 / ADR-0021 / ADR-0023: three real, embedded font families
// (Gelasio, Inter, JetBrains Mono - all SIL OFL 1.1, redistributable) replace PDFKit's
// standard-14 substitutes for every category (serif/sans/mono), not just the Georgia gap.
// Centralized here (not inline in PDFRenderer) so adding another family later - e.g. a
// Noto family for RTL/CJK support (ADR-0019 finding 2, flagged not scheduled) - is a
// single new entry in FAMILIES, not a change scattered across PDFRenderer's rendering
// logic. See backend/assets/fonts/README.md for each family's source, version, and license.
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');

export interface FontFamilyDefinition {
  /** Base name fonts are registered under with PDFKit; weight/style variants suffix it. */
  name: string;
  /** Matches a theme's logical font family string (e.g. Theme.fonts.body = "Georgia"). */
  match: RegExp;
  files: {
    regular: string;
    bold: string;
    italic: string;
    boldItalic: string;
  };
}

const FAMILIES: FontFamilyDefinition[] = [
  {
    name: 'JetBrainsMono',
    match: /courier|mono|consolas/i,
    files: {
      regular: 'JetBrainsMono-Regular.ttf',
      bold: 'JetBrainsMono-Bold.ttf',
      italic: 'JetBrainsMono-Italic.ttf',
      boldItalic: 'JetBrainsMono-BoldItalic.ttf',
    },
  },
  {
    name: 'Gelasio',
    match: /times|georgia|serif|garamond|palatino|cambria|book antiqua|minion/i,
    files: {
      regular: 'Gelasio-Regular.ttf',
      bold: 'Gelasio-Bold.ttf',
      italic: 'Gelasio-Italic.ttf',
      boldItalic: 'Gelasio-BoldItalic.ttf',
    },
  },
  {
    name: 'Inter',
    match: /arial|helvetica|sans|verdana|tahoma|segoe|calibri/i,
    files: {
      regular: 'Inter-Regular.ttf',
      bold: 'Inter-Bold.ttf',
      italic: 'Inter-Italic.ttf',
      boldItalic: 'Inter-BoldItalic.ttf',
    },
  },
];

// Inter (sans-serif, last in FAMILIES) is also the default when a theme's font name
// matches none of the patterns above - same fallback behavior the old Helvetica-by-
// default heuristic had.
const DEFAULT_FAMILY = FAMILIES[FAMILIES.length - 1];

function resolveFamily(fontFamily: string): FontFamilyDefinition {
  return FAMILIES.find((f) => f.match.test(fontFamily)) ?? DEFAULT_FAMILY;
}

/**
 * Owns the mapping from a theme's logical font family name to a real, embedded PDFKit
 * font - both which family (Gelasio/Inter/JetBrains Mono) and which physical .ttf file
 * backs each weight/style. PDFRenderer only calls registerAll() once per document and
 * resolve() per run; it never touches font file paths directly.
 */
export class PdfFontRegistry {
  /** Fonts are registered per-document (PDFKit has no global font registry). */
  registerAll(doc: PDFKit.PDFDocument): void {
    for (const family of FAMILIES) {
      doc.registerFont(family.name, join(FONTS_DIR, family.files.regular));
      doc.registerFont(`${family.name}-Bold`, join(FONTS_DIR, family.files.bold));
      doc.registerFont(`${family.name}-Italic`, join(FONTS_DIR, family.files.italic));
      doc.registerFont(`${family.name}-BoldItalic`, join(FONTS_DIR, family.files.boldItalic));
    }
  }

  /** Resolves a theme's logical font family + weight/style to a registered PDFKit font name. */
  resolve(fontFamily: string, bold: boolean, italic: boolean): string {
    const family = resolveFamily(fontFamily).name;
    return this.variant(family, bold, italic);
  }

  /**
   * Resolves the default (sans-serif) embedded family for content with no theme font of
   * its own - page chrome (running header/footer) and chapter/section titles, which
   * PDFRenderer draws independently of any block's ResolvedBlockStyle. Still routes
   * through this registry rather than a raw PDFKit standard-14 name, so PdfFontRegistry
   * stays the only place that knows a font file path or family name.
   */
  resolveDefault(bold: boolean, italic: boolean): string {
    return this.variant(DEFAULT_FAMILY.name, bold, italic);
  }

  private variant(family: string, bold: boolean, italic: boolean): string {
    if (bold && italic) return `${family}-BoldItalic`;
    if (bold) return `${family}-Bold`;
    if (italic) return `${family}-Italic`;
    return family;
  }
}
