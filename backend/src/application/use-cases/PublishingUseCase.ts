import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { Renderer } from '../../domain/ports/Renderer';
import type { PublishingTarget } from '../../domain/ports/PublishingTarget';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { ThemeEngine } from '../../domain/services/ThemeEngine';
import type { TypographyResolver } from '../../domain/services/TypographyResolver';
import type { LayoutEngine } from '../../domain/services/LayoutEngine';
import type { PageLayout } from '../../domain/models/PageLayout';
import type { PublishingReport } from '../../domain/models/PublishingReport';
import type { RenderMetrics } from '../../domain/models/RenderMetrics';
import { getTheme } from '../../domain/themes/getTheme';

export interface PublishRequest {
  buffer: Buffer;
  filename: string;
  themeName: string;
  pageLayout: PageLayout;
}

// Mirrors ExportManuscriptUseCase's exact shape (Decision 6), with one additional
// responsibility: delegating to PublishingTarget once rendering is done (CTO requirement,
// Commit 5). Never contains KDP rules, never packages, never calls SubmissionValidator
// directly, never knows validation-rule detail - it orchestrates Domain/Application
// components exactly as ExportManuscriptUseCase already does, same discipline one step further.
export class PublishingUseCase implements UseCase<PublishRequest, PublishingReport> {
  constructor(
    private parser: DocumentParser,
    private normalizer: DocumentNormalizer,
    private builder: ASTBuilder,
    private themeEngine: ThemeEngine,
    private typographyResolver: TypographyResolver,
    private layoutEngine: LayoutEngine,
    private renderer: Renderer<Buffer>,
    private publishingTarget: PublishingTarget
  ) {}

  async execute(request: PublishRequest): Promise<PublishingReport> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const book = this.builder.build(normalized);

    const theme = getTheme(request.themeName);
    const styled = this.themeEngine.applyTheme(book, theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, request.pageLayout);

    const pdf = await this.renderer.render(paginated, { language: book.metadata.language });

    // The real paginated count, captured here rather than measured downstream (ADR-0042).
    // This use case is the last place that holds the PaginatedBook: before this fix it computed
    // pagination, rendered from it, then discarded it, leaving PageCountRule to report
    // PAGE_COUNT_UNKNOWN on every real manuscript (ADR-0038).
    //
    // Assembled here rather than returned by Renderer deliberately (RENDER_METRICS.md Q1): the
    // Renderer port has three implementations and widening its return type would change all
    // three plus the export path, for no gain. ADR-0012 stays untouched.
    const metrics: RenderMetrics = {
      pageCount: paginated.pages.length,
      pageLayout: paginated.pageLayout,
    };

    return this.publishingTarget.prepare(book, { pdf: { bytes: pdf, metrics } });
  }
}
