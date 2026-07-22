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
 * The tri-format proof on a REAL manuscript (MINI_DR_DROP_CAPS §6 commit 4, §4 as reframed):
 * ONE declared theme value — scope chapterOpening + scale — and each format renders the SAME
 * visual concept through its native mechanism, in the SAME places:
 *  - PDF: the glyph at scale with the band indented beside it (PR #26's strategy);
 *  - DOCX: Word's own drop-cap frame (the §4bis Option-A convergence, commit 1);
 *  - EPUB: the floated `.dropcap` span sized by the same declared em.
 * The count is the cross-format invariant: every chapter whose first block is a paragraph — the
 * §5 positional rule, computed here from the real imported book, never hardcoded — carries
 * exactly one ornament in every format. Real chapters opening on headings/quotes/nothing are
 * the rule's negative space and must stay bare everywhere alike.
 */
async function buildBook(): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

function dropCapClassic(): Theme {
  return {
    ...resolveTheme('classic'),
    name: 'dropcap-proof',
    presentation: { dropCap: { scope: 'chapterOpening', scale: 2.5 } },
  };
}

describe('drop caps on real faith-alone, tri-format (MINI_DR_DROP_CAPS §6 commit 4)', () => {
  it('one declared value, one set of openings, three native mechanisms — with charged == consumed intact', async () => {
    const book = await buildBook();

    // The §5 rule computed from the real book — the expected opening count all three formats
    // must agree with. Faith-alone is book-length; if this ever lands at 0 the trigger is dead
    // and the whole test would pass vacuously, so the floor is asserted first.
    const expectedOpenings = book.mainContent.filter(
      (c) => c.type === 'chapter' && c.content[0]?.type === 'paragraph' && c.content[0].text.trim().length > 0
    ).length;
    expect(expectedOpenings).toBeGreaterThan(5);

    const theme = dropCapClassic();
    const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);

    // The resolver fired exactly the §5 set.
    const fired = Object.values(typeset.blockTypography ?? {}).filter((t) => t.dropCap).length;
    expect(fired).toBe(expectedOpenings);

    // PDF — charged == consumed holds with the ornament live on a real book: reconciliations
    // stay in the known residual class (the 6x9 corpus bound the typography lock also uses),
    // and no drop cap degrades. The physical count exceeds the plan by the FRONT-MATTER pages
    // (title/copyright render as planned physical pages outside pages[]), so the honest
    // invariant is comparative, asserted against the bare render below: the ornament must not
    // change that surplus by a single unaccounted page.
    const origWarn = console.warn;
    console.warn = () => {};
    const pdf = await new PDFRenderer().render(paginated, { language: 'en' });
    console.warn = origWarn;
    expect(pdf.metrics.unplannedPageBreaks).toBeLessThanOrEqual(2);
    expect(pdf.metrics.degradedDropCaps).toBe(0);

    // DOCX — one native frame per opening, in Word's own attribute-free shape (commit 1).
    const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
    const documentXml = await (await JSZip.loadAsync(docx.output)).file('word/document.xml')!.async('string');
    const frames = documentXml.match(/<w:framePr[^>]*w:dropCap="drop"[^>]*\/>/g) ?? [];
    expect(frames).toHaveLength(expectedOpenings);
    for (const frame of frames) expect(frame).not.toMatch(/w:(w|h|x|y)=/);

    // EPUB — one floated span per opening, the stylesheet sized by the same declared value.
    const epub = await new EPUBRenderer().render(paginated, { language: 'en' });
    const epubZip = await JSZip.loadAsync(epub.output);
    const texts = await Promise.all(
      Object.keys(epubZip.files)
        .filter((f) => /\.(css|xhtml|html|opf)$/i.test(f))
        .map((f) => epubZip.file(f)!.async('string'))
    );
    const epubText = texts.join('\n');
    expect(epubText.match(/<span class="dropcap">/g) ?? []).toHaveLength(expectedOpenings);
    expect(epubText).toContain('font-size: 2.5em');

    // And the negative space: the SAME book under the shipped theme grows nothing, anywhere.
    const bareTypeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(orderByRole(book), resolveTheme('classic')));
    expect(Object.values(bareTypeset.blockTypography ?? {}).filter((t) => t.dropCap)).toHaveLength(0);
    const barePaginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(bareTypeset, KDP6x9PageLayout);
    const bareDocx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(barePaginated, { language: 'en' });
    const bareXml = await (await JSZip.loadAsync(bareDocx.output)).file('word/document.xml')!.async('string');
    expect(bareXml).not.toContain('w:framePr');

    // The comparative physical-surplus invariant announced above: real pages beyond
    // (plan + unplanned) are the front-matter/blank overhead, and it must be IDENTICAL with and
    // without the ornament — a drop cap may move planned pages, never smuggle physical ones.
    console.warn = () => {};
    const barePdf = await new PDFRenderer().render(barePaginated, { language: 'en' });
    console.warn = origWarn;
    const surplusWith = pdf.metrics.pageCount! - paginated.pages.length - pdf.metrics.unplannedPageBreaks!;
    const surplusBare = barePdf.metrics.pageCount! - barePaginated.pages.length - barePdf.metrics.unplannedPageBreaks!;
    expect(surplusWith).toBe(surplusBare);
  }, 240_000);
});
