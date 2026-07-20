/**
 * THROWAWAY SCOPE SPIKE — subtitle (chapter/section title) spacing in the PDF, measured on
 * faith-alone. Read-only: quantifies the gap above vs. below a subtitle and contrasts it with how
 * heading *blocks* are spaced. No production code. Run: npx tsx spikes/subtitle-spacing-scope.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { getTheme } from '../src/domain/themes/getTheme';
import type { Content } from '../src/domain/models/Book';

const CORPUS = join(process.cwd(), 'verification', 'corpus', 'faith-alone-styled.docx');

async function main() {
  const raw = await new MammothParser().parse(readFileSync(CORPUS));
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' });
  const book = new ASTBuilder().build(normalized);
  const theme = getTheme('classic');
  const measurer = new PdfKitTextMeasurer();

  // renderTitle's own size formula (PDFRenderer.renderTitle) + LayoutEngine's titleHeightOf.
  const sizeOf = (c: Content) => (c.type === 'chapter' ? 24 : Math.max(12, 22 - c.level * 2));

  const levels = new Map<string, { count: number; size: number }>();
  let chapters = 0;
  const walk = (contents: Content[]) => {
    for (const c of contents) {
      if (c.type === 'chapter') {
        chapters++;
        if (c.sections) walk(c.sections);
      } else if (c.type === 'section') {
        const key = `section L${c.level}`;
        const e = levels.get(key) ?? { count: 0, size: sizeOf(c) };
        e.count++;
        levels.set(key, e);
        if (c.subsections) walk(c.subsections);
      }
    }
  };
  walk(book.mainContent);

  console.log('theme.spacing:', JSON.stringify(theme.spacing));
  const headingSpacing = theme.spacing.headingSpacing;
  const paragraphSpacing = theme.spacing.paragraphSpacing;
  console.log(`chapters: ${chapters}`);
  console.log('\nSUBTITLES (chapter/section titles) — space ABOVE vs BELOW, as rendered today:');
  console.log('  space ABOVE  = the previous block\'s spaceAfter only (paragraphSpacing, flat) — renderTitle adds NONE');
  console.log('  space BELOW  = doc.moveDown() = one line at the title\'s own font size (lineHeight(size, heading))\n');

  const rows: Array<[string, number, number, number]> = [];
  rows.push(['chapter title', 24, paragraphSpacing, measurer.lineHeight(24, { theme, heading: true })]);
  for (const [key, { count, size }] of [...levels.entries()].sort()) {
    rows.push([`${key} (${count}×)`, size, paragraphSpacing, measurer.lineHeight(size, { theme, heading: true })]);
  }

  for (const [label, size, above, below] of rows) {
    console.log(
      `  ${label.padEnd(22)} size ${String(size).padStart(2)}pt | above ~${above.toFixed(1)}pt | below ~${below.toFixed(1)}pt | ratio below/above ${(below / above).toFixed(1)}×`
    );
  }

  console.log(`\nCONTRAST — a heading BLOCK (ThemeEngine.resolveBlockStyle) is spaced SYMMETRICALLY:`);
  console.log(`  space above = space below = headingSpacing = ${headingSpacing}pt (flat, measured, theme-driven)`);
  console.log(`\nSo the same conceptual element (a heading) is spaced two different ways, and real DOCX`);
  console.log(`imports produce chapter/section TITLES (not heading blocks), so faith-alone's ${[...levels.values()].reduce((n, e) => n + e.count, 0)} subtitles`);
  console.log(`all take the moveDown path: no space above, a size-dependent line below.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
