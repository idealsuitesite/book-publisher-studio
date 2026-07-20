/**
 * Footer trace — captures the exact `Page N of M` string drawn on each physical PDF page,
 * plus the pageOwners alignment, to reproduce the stuck-counter defect (Défaut B). Wraps the
 * doc's text() during the header/footer pass. Diagnostic ONLY. Run:
 *   npx tsx spikes/footer-trace-spike.ts [fixture]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = process.argv[2] ?? join('verification', 'corpus', 'faith-alone-styled.docx');

async function main() {
  const raw = await new MammothParser().parse(readFileSync(join(__dirname, '..', fixture)));
  const norm = new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' });
  const built = new ASTBuilder().build(norm);
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);

  // Capture every "Page N of M" text() call, tagged with the physical page it lands on.
  const footers: Array<{ physical: number; text: string }> = [];
  const renderer = new PDFRenderer();
  const proto = Object.getPrototypeOf(renderer) as Record<string, unknown>;
  const origDraw = proto.drawHeadersAndFooters as (...a: unknown[]) => unknown;
  proto.drawHeadersAndFooters = function (this: unknown, doc: PDFKit.PDFDocument, ...rest: unknown[]) {
    const realText = doc.text.bind(doc);
    (doc as unknown as { text: (...a: unknown[]) => unknown }).text = (t: unknown, ...args: unknown[]) => {
      if (typeof t === 'string' && t.startsWith('Page ')) {
        const range = doc.bufferedPageRange();
        // switchToPage set the current page; read it back
        const current = (doc as unknown as { _pageBuffer: unknown[]; page: unknown })._pageBuffer.indexOf(
          (doc as unknown as { page: unknown }).page
        );
        footers.push({ physical: current - range.start + 1, text: t });
      }
      return realText(t as string, ...(args as [number, number, PDFKit.Mixins.TextOptions]));
    };
    return origDraw.call(this, doc, ...rest);
  };

  await renderer.render(paginated, { language: 'en' });

  console.log(`fixture: ${fixture}`);
  console.log(`model pages: ${paginated.pages.length} | footers drawn: ${footers.length}`);
  console.log('first 16 drawn footers (physical page -> text):');
  for (const f of footers.slice(0, 16)) console.log(`  p${f.physical}: "${f.text}"`);
  const distinct = new Set(footers.map((f) => f.text));
  console.log(`distinct footer strings: ${distinct.size}`);
  const nums0 = footers.map((f) => Number(/Page (\d+)/.exec(f.text)?.[1] ?? -1));
  const dupPositions = footers.filter((f, i) => i > 0 && nums0[i] <= nums0[i - 1]).map((f) => f.text);
  console.log(`duplicate/non-increasing footers: ${JSON.stringify(dupPositions)}`);
  // do the numerators progress?
  const nums = footers.map((f) => Number(/Page (\d+)/.exec(f.text)?.[1] ?? -1));
  const nonMonotonic = nums.filter((n, i) => i > 0 && n <= nums[i - 1]).length;
  console.log(`non-increasing steps in the numerator sequence: ${nonMonotonic}/${nums.length - 1}`);
}

main();
