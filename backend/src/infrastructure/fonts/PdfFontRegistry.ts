import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Theme } from '../../domain/models/Theme';

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

const MONOSPACE_FAMILY = FAMILIES[0]; // JetBrainsMono

// Inter (sans-serif, last in FAMILIES) is also the default when a theme's font name
// matches none of the patterns above - same fallback behavior the old Helvetica-by-
// default heuristic had.
const DEFAULT_FAMILY = FAMILIES[FAMILIES.length - 1];

function resolveFamily(fontFamily: string): FontFamilyDefinition {
  return FAMILIES.find((f) => f.match.test(fontFamily)) ?? DEFAULT_FAMILY;
}

/**
 * Owns every PDF font decision: which of the 3 embedded families (Gelasio/Inter/
 * JetBrains Mono) backs a given typographic *role*, which physical .ttf file backs each
 * weight/style, and registering them with PDFKit. Deliberately role-based
 * (resolveBody/resolveHeading/resolveMonospace/resolveDefault), not string-based -
 * PDFRenderer never inspects a theme's font-name string or does its own family-matching;
 * it only asks for a role and gets a registered PDFKit font name back. Contains no PDF
 * *rendering* logic (no doc.font() selection calls, no coordinates, no font sizes) - only
 * font registration and name resolution - so this can become the template for a shared
 * FontRegistry across PDF/DOCX/EPUB later without carrying any PDF-specific drawing
 * concerns with it.
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

  /** Body text role - resolves from the theme's body font (e.g. paragraphs, quotes, lists, footnotes, tables). */
  resolveBody(theme: Theme, bold: boolean, italic: boolean): string {
    return this.variant(resolveFamily(theme.fonts.body).name, bold, italic);
  }

  /**
   * Heading role for the given level - resolves from the theme's heading font. `level`
   * is accepted now (not yet used to vary the family) so a future theme that wants a
   * different family per heading level doesn't require an API change.
   */
  resolveHeading(_level: number, theme: Theme, bold: boolean, italic: boolean): string {
    return this.variant(resolveFamily(theme.fonts.heading).name, bold, italic);
  }

  /** Monospace role - always JetBrains Mono, independent of theme (e.g. future code blocks). */
  resolveMonospace(bold: boolean, italic: boolean): string {
    return this.variant(MONOSPACE_FAMILY.name, bold, italic);
  }

  /**
   * Default (sans-serif) role for content with no theme font of its own - page chrome
   * (running header/footer) that PDFRenderer draws independently of any block or theme.
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
