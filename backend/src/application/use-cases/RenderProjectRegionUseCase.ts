import type { ProjectRepository } from '../../domain/ports/ProjectRepository';
import type { LayoutSelector } from '../../domain/ports/LayoutSelector';
import type { PaginationCache } from '../../domain/ports/PaginationCache';
import type { PageRangeRenderer } from '../../domain/ports/PageRangeRenderer';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { ExportManuscriptUseCase } from './ExportManuscriptUseCase';

export interface RegionRenderResult {
  /** The region PDF (only the pages in the requested range). */
  pdf: Buffer;
  /** The book's real domain page count — so the caller can clamp/build its scroll window. */
  totalDomainPages: number;
  /** The range actually rendered, after clamping to [1, totalDomainPages]. */
  startPage: number;
  endPage: number;
}

/**
 * INCREMENTAL_RENDER (P1, commit 2) — the region-render API's use case. Renders ONLY the visible page
 * range of a project's STORED book, so the living Proof updates in milliseconds without redrawing the
 * whole book (criterion A / fluidity — AUTHOR_EXPERIENCE Axis 7).
 *
 * It paginates the project's book through the SAME shared tail as the full export
 * (`ExportManuscriptUseCase.paginate` — theme/typography/layout, pagination cache included) and then
 * region-renders that identical `PaginatedBook` via the `PageRangeRenderer` port. Feeding the region
 * the full pagination's own `Page` objects is what makes page-region ≡ page-export free by construction
 * (INCREMENTAL_RENDER_DR §1) — no second pagination, no second render path.
 *
 * `totalPages` is the full book's REAL PHYSICAL page count and is supplied by the CALLER: the studio
 * renders the whole book once on open (the export path) and reads the count from that PDF, then passes
 * it here on every edit so the footer reads "Page n of <full total>", identical to the export. The
 * region path deliberately does NOT full-render (that is the whole performance win), so it cannot
 * re-measure the physical total itself; a content edit that changes the count is re-synced by the next
 * full render (the window policy, a later commit) — a disclosed, self-correcting approximation.
 */
export class RenderProjectRegionUseCase {
  constructor(
    private repository: ProjectRepository,
    private pdfExporter: ExportManuscriptUseCase,
    private pageRangeRenderer: PageRangeRenderer,
    private layoutSelector: LayoutSelector,
    private projectService: ProjectService,
    private paginationCache?: PaginationCache
  ) {}

  async execute(
    projectId: string,
    startPage: number,
    endPage: number,
    totalPages: number
  ): Promise<RegionRenderResult | undefined> {
    const project = await this.repository.findById(projectId);
    if (!project) return undefined;

    const pageLayout = this.layoutSelector.select({ requestedLayoutName: project.settings.layoutName });
    const book = this.projectService.currentBook(project);
    const paginated = this.pdfExporter.paginate(
      book,
      project.settings.themeName,
      pageLayout,
      project.settings.accentOverride,
      this.paginationCache,
      project.settings.typographyOverride
    );

    // Clamp the requested range into the book's real page count — the window policy asks for
    // visible ± neighbours and legitimately runs past the ends near the first/last page. A clamped,
    // in-bounds range keeps renderPageRange's leading/trailing-boundary logic well-defined.
    const total = paginated.pages.length;
    const clampedStart = Math.min(Math.max(1, Math.trunc(startPage)), total);
    const clampedEnd = Math.min(Math.max(clampedStart, Math.trunc(endPage)), total);

    const result = await this.pageRangeRenderer.renderPageRange(
      paginated,
      { language: book.metadata.language },
      clampedStart,
      clampedEnd,
      // The caller's known physical total; fall back to the domain count only if the caller omitted it
      // (a first-open call before any full render), so the footer is never "of NaN".
      Number.isFinite(totalPages) && totalPages > 0 ? Math.trunc(totalPages) : total
    );

    return { pdf: result.output, totalDomainPages: total, startPage: clampedStart, endPage: clampedEnd };
  }
}
