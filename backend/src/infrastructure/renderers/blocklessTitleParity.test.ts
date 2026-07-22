import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { getTheme } from '../../domain/themes/getTheme';
import { createBook } from '../../domain/models/Book';
import type { Book, Chapter, Section, Block } from '../../domain/models/Book';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { KDP6x9PageLayout } from '../../domain/layouts/KDP6x9PageLayout';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';

/**
 * MINI_DR_BLOCKLESS_TITLES, the renderer half of the invariant: a planned break BEFORE a
 * blockless section's title is expressed through the content's OWN id on the page
 * (the ownsBarePage precedent one level down), and the renderer consumes it as a planned
 * break — never as a PDFKit reconciliation. Charged == consumed, proven on the real
 * measurer + the real renderer, not on a synthetic ruler.
 */
describe('PDFRenderer - blockless titled section planned break', () => {
  const now = new Date();
  const paragraph = (id: string, text: string): Block => ({ type: 'paragraph', id, text });
  const emptySection = (id: string, title: string): Section => ({
    type: 'section', id, title, content: [], level: 2, createdAt: now, updatedAt: now,
  });
  const sectionWith = (id: string, blocks: Block[]): Section => ({
    type: 'section', id, title: 'After', content: blocks, level: 2, createdAt: now, updatedAt: now,
  });

  it('a planned page starting with the SECTION id renders with zero unplanned breaks and the exact planned page count', async () => {
    const measurer = new PdfKitTextMeasurer();
    // Find, with the REAL font metrics, a filler length that leaves too little room for the
    // empty section's title + 2 lines — the D3 guard must then plan the break, and the page
    // must open with the section's own id. Searching instead of hardcoding keeps the test
    // independent of Gelasio's exact metrics (the same reason the Phase B tests use a ruler —
    // here the renderer IS the subject, so the real face is the point).
    let paginated;
    for (let sentences = 20; sentences <= 90; sentences++) {
      const chapter: Chapter = {
        type: 'chapter', id: 'c-1', number: 1, title: 'One',
        content: [paragraph('p-1', 'A steady line of prose to spend the page. '.repeat(sentences))],
        sections: [emptySection('s-empty', 'The Empty Section'), sectionWith('s-next', [paragraph('p-2', 'Text that lands under the title.')])],
        createdAt: now, updatedAt: now,
      };
      const styled = new ThemeEngine().applyTheme(createBook({ title: 'T', author: 'A', language: 'en' }, [chapter]), ClassicTheme);
      const candidate = new LayoutEngine(measurer).paginate(new TypographyResolver().resolve(styled), LetterPageLayout);
      if (candidate.pages.some((p) => p.blocks[0] === 's-empty')) { paginated = candidate; break; }
    }
    expect(paginated, 'no filler length produced a planned break before the empty title — the guard never fired').toBeDefined();

    const result = await new PDFRenderer().render(paginated!, { language: 'en' });

    expect(result.metrics.unplannedPageBreaks).toBe(0);
    expect(result.metrics.pageCount).toBe(paginated!.pages.length);
  });

  it('an in-flow blockless title (no planned break) also renders at parity — the charge matches what renderTitle spends', async () => {
    const measurer = new PdfKitTextMeasurer();
    const chapter: Chapter = {
      type: 'chapter', id: 'c-1', number: 1, title: 'One',
      content: [paragraph('p-1', 'A short opening paragraph.')],
      sections: [emptySection('s-empty', 'The Empty Section'), sectionWith('s-next', [paragraph('p-2', 'Text that lands under the title.')])],
      createdAt: now, updatedAt: now,
    };
    const styled = new ThemeEngine().applyTheme(createBook({ title: 'T', author: 'A', language: 'en' }, [chapter]), ClassicTheme);
    const paginated = new LayoutEngine(measurer).paginate(new TypographyResolver().resolve(styled), LetterPageLayout);

    const result = await new PDFRenderer().render(paginated, { language: 'en' });

    expect(paginated.pages[0].blocks).toContain('s-empty');
    expect(result.metrics.unplannedPageBreaks).toBe(0);
    expect(result.metrics.pageCount).toBe(paginated.pages.length);
  });
});

/**
 * The §10.3 heading gate, renderer-enforced (MINI_DR_BLOCKLESS_TITLES D5): a reconciliation
 * that fires while a title is being drawn strands a heading at a page bottom. PUBLICATION_
 * QUALITY_BAR §10.3 claimed this was "enforced by construction and measured 0" — the cadrage
 * measured 1 real violation on Modern (the blockless §3 section). The claim is now a TEST on
 * the real corpus, per theme, via the named counter — not a construction argument.
 */
describe('§10.3 heading gate — unplannedTitleBreaks is 0 on the real corpus, all themes', () => {
  const CORPUS = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');
  let faith: Book;
  beforeAll(async () => {
    const raw = await new MammothParser().parse(readFileSync(CORPUS));
    const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' }));
    faith = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  }, 30_000);

  it.each(['classic', 'modern', 'novel'])('%s: no title is ever stranded by a reconciliation (kdp-6x9)', async (name) => {
    const styled = new ThemeEngine().applyTheme(faith, getTheme(name));
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(new TypographyResolver().resolve(styled), KDP6x9PageLayout);
    const origWarn = console.warn;
    console.warn = () => {};
    const result = await new PDFRenderer().render(paginated, { language: 'en' });
    console.warn = origWarn;

    expect(result.metrics.unplannedTitleBreaks).toBe(0);
  }, 60_000);
});
