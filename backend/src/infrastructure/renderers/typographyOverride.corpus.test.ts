import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { resolveTheme } from '../../domain/themes/getTheme';
import { orderByRole } from '../../domain/services/orderByRole';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { KDP6x9PageLayout } from '../../domain/layouts/KDP6x9PageLayout';
import type { Book } from '../../domain/models/Book';
import type { Theme } from '../../domain/models/Theme';

const FAITH_ALONE = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

/**
 * The real-fixture lock for the typography override (MINI_DR_TYPOGRAPHY_TUNING §2.7 — one of the
 * CTO's two closure attention points): faith-alone at Large print + sans body, through the real
 * pipeline. Three properties:
 *  - charged == consumed HOLDS UNDER THE OVERRIDE (unplanned stays in the known residual class)
 *    because measurer and renderer read the same resolved theme — the seam's whole argument;
 *  - the geometry moves in the MEASURED band (the scope spike put body 13pt at ~+32%; pairing
 *    adds ~+4% — the override must land in that vicinity, not "somewhere");
 *  - the pairing is TRI-FORMAT: the DOCX styles and the EPUB CSS carry the resolved font name.
 */
async function buildBook(): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

async function paginateAndRenderPdf(book: Book, theme: Theme) {
  const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  const origWarn = console.warn;
  console.warn = () => {};
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  console.warn = origWarn;
  return { modelPages: paginated.pages.length, metrics: result.metrics, paginated };
}

describe('typography override on real faith-alone (Large + sans body — the CTO closure lock)', () => {
  it('moves geometry in the measured band with charged == consumed intact, tri-format pairing proven', async () => {
    const book = await buildBook();
    const base = await paginateAndRenderPdf(book, resolveTheme('classic'));
    const overridden = await paginateAndRenderPdf(
      book,
      resolveTheme('classic', undefined, { preset: 'large', bodyFont: 'sans' })
    );

    // The measured band: body 13pt alone was +32% (155→204 model pages, the scope spike); the sans
    // body added ~+4% on its own. Together the override must land clearly above +25% — and if it
    // ever lands near base, the override silently stopped reaching the pipeline (the real defect
    // this lock exists to catch).
    expect(overridden.modelPages).toBeGreaterThan(base.modelPages * 1.25);

    // charged == consumed under the override: reconciliations stay in the known residual class,
    // never scaling with the 200+ pages that moved (ADR-0051 — loud, bounded, attributed).
    expect(overridden.metrics.unplannedPageBreaks).toBeLessThanOrEqual(2);

    // Tri-format pairing: DOCX styles carry the resolved sans name (→ embedded Inter)...
    const styledTheme = resolveTheme('classic', undefined, { preset: 'large', bodyFont: 'sans' });
    const styled = new ThemeEngine().applyTheme(orderByRole(book), styledTheme);
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);

    const docx = await new DOCXRenderer().render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(docx.output);
    const stylesXml = await zip.file('word/styles.xml')!.async('string');
    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(`${stylesXml}${documentXml}`).toContain('Helvetica');

    // ...and the EPUB CSS does too (the same resolved theme, one seam, three formats).
    const epub = await new EPUBRenderer().render(paginated, { language: 'en' });
    const epubZip = await JSZip.loadAsync(epub.output);
    const files = Object.keys(epubZip.files);
    const textChunks = await Promise.all(
      files.filter((f) => /\.(css|xhtml|html|opf)$/i.test(f)).map((f) => epubZip.file(f)!.async('string'))
    );
    expect(textChunks.join('\n')).toContain('Helvetica');
  }, 240_000);
});
