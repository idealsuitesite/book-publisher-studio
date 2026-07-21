import { describe, it, expect, vi } from 'vitest';
import { ExportProjectUseCase } from './ExportProjectUseCase';
import { ExportManuscriptUseCase } from './ExportManuscriptUseCase';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { PdfKitTextMeasurer } from '../../infrastructure/fonts/PdfKitTextMeasurer';
import { InMemoryPaginationCache } from '../../infrastructure/cache/InMemoryPaginationCache';
import { ManualLayoutSelector } from '../../domain/services/ManualLayoutSelector';
import { ProjectService } from '../../domain/services/ProjectService';
import { BookEditingService } from '../../domain/services/BookEditingService';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';
import type { Renderer, RenderResult, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { Project } from '../../domain/models/Project';
import type { Book } from '../../domain/models/Book';

const stubRenderer: Renderer<Buffer> = {
  async render(book: PaginatedBook, _ctx: RenderContext): Promise<RenderResult<Buffer>> {
    return { output: Buffer.from('pdf'), metrics: { pageLayout: book.pageLayout } };
  },
};

async function buildBook(paragraphs: string[]): Promise<Book> {
  const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs });
  const raw = await new MammothParser().parse(buffer);
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'm.docx' }));
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

/**
 * The CTO's explicit closure requirement (MINI_DR_PAGINATION_REUSE §5): the key must INVALIDATE on
 * any real structure/theme/layout change — not merely reuse on the accent case. Proven by spying on
 * the shared LayoutEngine.paginate: a cache hit skips it, a miss calls it.
 */
describe('ExportProjectUseCase pagination cache invalidation', () => {
  it('accent-only change reuses; structure/theme/layout change re-paginates', async () => {
    const layoutEngine = new LayoutEngine(new PdfKitTextMeasurer());
    const paginate = vi.spyOn(layoutEngine, 'paginate');
    const exporter = new ExportManuscriptUseCase(
      new MammothParser(),
      new HtmlNormalizer(),
      new ASTBuilder(),
      new ThemeEngine(),
      new TypographyResolver(),
      layoutEngine,
      stubRenderer
    );
    const cache = new InMemoryPaginationCache();
    const svc = new ProjectService();

    let project: Project = svc.create(await buildBook(['One.', 'Two.']), { layoutName: 'letter', themeName: 'classic' }, 'T');
    const repo = { findById: async () => project } as unknown as ProjectRepository;
    const useCase = new ExportProjectUseCase(
      repo,
      { docx: exporter, pdf: exporter, epub: exporter },
      new ManualLayoutSelector(),
      svc,
      cache
    );

    await useCase.execute(project.id, 'pdf'); // MISS -> paginate #1
    expect(paginate).toHaveBeenCalledTimes(1);

    project = svc.updateSettings(project, { accentOverride: '#EE0000' });
    await useCase.execute(project.id, 'pdf'); // HIT (accent excluded from key)
    expect(paginate).toHaveBeenCalledTimes(1);

    project = svc.replaceBook(project, await buildBook(['One.', 'Two.', 'Three.'])); // structure change
    await useCase.execute(project.id, 'pdf'); // MISS -> paginate #2
    expect(paginate).toHaveBeenCalledTimes(2);

    project = svc.updateSettings(project, { themeName: 'modern' }); // theme change
    await useCase.execute(project.id, 'pdf'); // MISS -> paginate #3
    expect(paginate).toHaveBeenCalledTimes(3);

    project = svc.updateSettings(project, { layoutName: 'a4' }); // layout change
    await useCase.execute(project.id, 'pdf'); // MISS -> paginate #4
    expect(paginate).toHaveBeenCalledTimes(4);

    project = svc.updateSettings(project, { accentOverride: '#00AA00' }); // accent again on the settled state
    await useCase.execute(project.id, 'pdf'); // HIT
    expect(paginate).toHaveBeenCalledTimes(4);

    // PART_LEVEL_STRUCTURE §3.6 (the CTO's named property): inserting/removing a part divider is
    // a book edit -> a new content hash -> a MISS by construction; serving the part-less geometry
    // after an insert would be exactly the silent-drift class the key-completeness rule guards.
    const editing = new BookEditingService();
    project = svc.replaceBook(project, editing.insertPartOpener(svc.currentBook(project), 0, 'Part I'));
    await useCase.execute(project.id, 'pdf'); // MISS -> paginate #5
    expect(paginate).toHaveBeenCalledTimes(5);

    project = svc.updateSettings(project, { accentOverride: '#111111' }); // accent over the part-bearing book
    await useCase.execute(project.id, 'pdf'); // HIT (openers cached like any geometry)
    expect(paginate).toHaveBeenCalledTimes(5);

    const openerId = svc.currentBook(project).mainContent[0].id;
    project = svc.replaceBook(project, editing.removePartOpener(svc.currentBook(project), openerId));
    await useCase.execute(project.id, 'pdf');
    // A LEGITIMATE HIT, and the deeper §3.6 property: removing the opener restores the book to
    // byte-identical pre-insert content, whose geometry is already cached — and serving it is
    // CORRECT (same content -> same geometry). The content-hash key cannot confuse the two
    // states because they ARE the same state; "invalidation" means never serving the WRONG
    // geometry, which the insert-side miss above proves for the state that was genuinely new.
    expect(paginate).toHaveBeenCalledTimes(5);
  });
});
