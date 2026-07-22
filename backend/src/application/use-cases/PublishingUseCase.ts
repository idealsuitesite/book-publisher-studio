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
import type { Book } from '../../domain/models/Book';
import type { TypographyOverride } from '../../domain/models/Project';
import type { PublishingReport } from '../../domain/models/PublishingReport';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { resolveTheme } from '../../domain/themes/getTheme';
import { orderByRole } from '../../domain/services/orderByRole';

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
    private publishingTarget: PublishingTarget,
    private frontMatterBuilder: FrontMatterBuilder = new FrontMatterBuilder()
  ) {}

  async execute(request: PublishRequest): Promise<PublishingReport> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const built = this.builder.build(normalized);

    // Raw-bytes route (/api/manuscripts/publish): no stored book, so front matter is synthesised
    // here at the boundary — the same book export ships (ADR-0045), never inside publishBook.
    // Since Q3, the project path populates front matter at import and publishes stored content.
    const book = { ...built, frontMatter: this.frontMatterBuilder.build(built) };
    return this.publishBook(book, request.themeName, request.pageLayout);
  }

  /**
   * Publishes an already-built `Book` — the render tail plus the `PublishingTarget` step.
   * **Publishes the book's front matter exactly as given — no synthesis.**
   *
   * Mirrors `ExportManuscriptUseCase.renderBook`: `execute()` feeds it a book parsed from upload
   * bytes (front matter synthesised at the boundary), and the project publish path
   * (`PublishProjectUseCase`) feeds it the project's STORED book so structure edits and stored
   * front matter reach what KDP validates. Publishing the stored book also keeps publish and
   * export rendering the *same* book by construction (ADR-0045's original concern; ADR-0052).
   */
  async publishBook(
    book: Book,
    themeName: string,
    pageLayout: PageLayout,
    accentOverride?: string,
    typographyOverride?: TypographyOverride
  ): Promise<PublishingReport> {
    // The publish tail applies the same per-project overrides as the export tail, through the one
    // shared resolveTheme seam (MINI_DR_PER_THEME_ACCENT / MINI_DR_TYPOGRAPHY_TUNING) — publish
    // and export stay identical, so what KDP validates is what the author's Proof shows.
    const theme = resolveTheme(themeName, accentOverride, typographyOverride);
    // Editorial-part placement (MINI_DR_EDITORIAL_PLACEMENT): same ordering as the export tail, so
    // publish and export place front/back matter identically (ADR-0052).
    const styled = this.themeEngine.applyTheme(orderByRole(book), theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, pageLayout);

    // Metrics come from the renderer, not from `paginated` (ADR-0045). RENDER_METRICS.md
    // Question 1 answered this the other way and was wrong twice over: ADR-0013 already recorded
    // that `PaginatedBook.pages.length` drifts from the real rendered count, and front matter
    // compounds it, since PDFRenderer emits title and copyright pages pagination never saw.
    const { output: bytes, metrics } = await this.renderer.render(paginated, {
      language: book.metadata.language,
    });

    return this.publishingTarget.prepare(book, { pdf: { bytes, metrics } });
  }
}
