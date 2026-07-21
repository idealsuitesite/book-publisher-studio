import { describe, it, expect, vi } from 'vitest';
import { ExportManuscriptUseCase, paginationKey } from './ExportManuscriptUseCase';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { PdfKitTextMeasurer } from '../../infrastructure/fonts/PdfKitTextMeasurer';
import { InMemoryPaginationCache } from '../../infrastructure/cache/InMemoryPaginationCache';
import { resolveTheme } from '../../domain/themes/getTheme';
import { orderByRole } from '../../domain/services/orderByRole';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import type { Renderer, RenderResult, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { Book } from '../../domain/models/Book';

/** A renderer that records the PaginatedBook it was handed, so we can assert on the geometry and
 *  the accent colour that reached the renderer — the exact seam, not the lossy PDF bytes. */
class CapturingRenderer implements Renderer<Buffer> {
  readonly captured: PaginatedBook[] = [];
  async render(book: PaginatedBook, _context: RenderContext): Promise<RenderResult<Buffer>> {
    this.captured.push(book);
    return { output: Buffer.from('pdf'), metrics: { pageLayout: book.pageLayout } };
  }
}

async function buildBook(paragraphs: string[] = ['Hello world.', 'A second paragraph of text.']): Promise<Book> {
  const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs });
  const raw = await new MammothParser().parse(buffer);
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'm.docx' }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

function buildUseCase(renderer: CapturingRenderer, layoutEngine: LayoutEngine) {
  return new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    layoutEngine,
    renderer
  );
}

describe('renderBook pagination reuse (MINI_DR_PAGINATION_REUSE)', () => {
  it('reuses geometry and RE-INKS on an accent-only change (the §3 trap avoided)', async () => {
    const renderer = new CapturingRenderer();
    const layoutEngine = new LayoutEngine(new PdfKitTextMeasurer());
    const paginate = vi.spyOn(layoutEngine, 'paginate');
    const useCase = buildUseCase(renderer, layoutEngine);
    const cache = new InMemoryPaginationCache();
    const book = await buildBook();

    await useCase.renderBook(book, 'classic', LetterPageLayout, '#111111', cache); // accent A
    await useCase.renderBook(book, 'classic', LetterPageLayout, '#EE0000', cache); // accent B

    // Pagination ran once — the second render was a cache hit.
    expect(paginate).toHaveBeenCalledTimes(1);

    const [first, second] = renderer.captured;
    // The reused render carries the NEW accent (not the stale one) — recolour, not restale.
    expect(first.styledBook.theme.colors.accent).toBe('#111111');
    expect(second.styledBook.theme.colors.accent).toBe('#EE0000');
    // ...over IDENTICAL geometry.
    expect(second.pages).toEqual(first.pages);
  });

  it('the geometry is accent-invariant at the pages[] level (the precondition reuse rests on)', async () => {
    const layoutEngine = new LayoutEngine(new PdfKitTextMeasurer());
    const book = await buildBook(Array.from({ length: 40 }, (_, i) => `Paragraph number ${i} with several words to fill the line.`));

    const paginateWith = (accent: string) => {
      const styled = new ThemeEngine().applyTheme(orderByRole(book), resolveTheme('classic', accent));
      const typeset = new TypographyResolver().resolve(styled);
      return layoutEngine.paginate(typeset, LetterPageLayout).pages;
    };

    // Two very different accents must produce byte-for-byte the same page geometry.
    expect(paginateWith('#EE0000')).toEqual(paginateWith('#0000EE'));
    // And an override vs none — same geometry.
    const noOverride = (() => {
      const styled = new ThemeEngine().applyTheme(orderByRole(book), resolveTheme('classic'));
      return layoutEngine.paginate(new TypographyResolver().resolve(styled), LetterPageLayout).pages;
    })();
    expect(paginateWith('#EE0000')).toEqual(noOverride);
  });

  it('without a cache (the raw-bytes /export path) paginates every time — unchanged behaviour', async () => {
    const renderer = new CapturingRenderer();
    const layoutEngine = new LayoutEngine(new PdfKitTextMeasurer());
    const paginate = vi.spyOn(layoutEngine, 'paginate');
    const useCase = buildUseCase(renderer, layoutEngine);
    const book = await buildBook();

    await useCase.renderBook(book, 'classic', LetterPageLayout, '#111111');
    await useCase.renderBook(book, 'classic', LetterPageLayout, '#111111');

    expect(paginate).toHaveBeenCalledTimes(2);
  });

  it('a cache hit yields the same geometry a fresh paginate would (cache is output-neutral)', async () => {
    const book = await buildBook();
    const layoutEngine = new LayoutEngine(new PdfKitTextMeasurer());

    const cached = new CapturingRenderer();
    const uncached = new CapturingRenderer();
    const cache = new InMemoryPaginationCache();
    // Prime the cache, then a second (hit) render.
    await buildUseCase(cached, layoutEngine).renderBook(book, 'classic', LetterPageLayout, '#111111', cache);
    await buildUseCase(cached, layoutEngine).renderBook(book, 'classic', LetterPageLayout, '#222222', cache);
    // A wholly independent render with NO cache, same second accent.
    await buildUseCase(uncached, layoutEngine).renderBook(book, 'classic', LetterPageLayout, '#222222');

    expect(cached.captured[1].pages).toEqual(uncached.captured[0].pages);
  });
});

describe('paginationKey', () => {
  it('is identical across accent changes but differs on theme or layout', async () => {
    const book = await buildBook();
    const base = paginationKey(book, 'classic', LetterPageLayout);
    // accent is not an input to the key at all — same book/theme/layout => same key.
    expect(paginationKey(book, 'classic', LetterPageLayout)).toBe(base);
    // theme and layout DO change the key.
    expect(paginationKey(book, 'modern', LetterPageLayout)).not.toBe(base);
    expect(paginationKey(book, 'classic', { ...LetterPageLayout, marginLeft: 99 })).not.toBe(base);
  });

  it('changes when the book content changes', async () => {
    const a = paginationKey(await buildBook(['One.']), 'classic', LetterPageLayout);
    const b = paginationKey(await buildBook(['One.', 'Two.']), 'classic', LetterPageLayout);
    expect(a).not.toBe(b);
  });
});
