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
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
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
    private publishingTarget: PublishingTarget,
    private frontMatterBuilder: FrontMatterBuilder = new FrontMatterBuilder()
  ) {}

  async execute(request: PublishRequest): Promise<PublishingReport> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const built = this.builder.build(normalized);

    // Front matter is built here for the same reason ExportManuscriptUseCase builds it, and it
    // must be the *same* book. Until this line existed, publish validated a manuscript with no
    // title or copyright page while export shipped one with both - so the Publishing Engine was
    // approving a document the author would never upload. Found by real-fixture verification:
    // the exported PDFs had 3 pages and the reported page count said 1 (ADR-0045).
    const book = { ...built, frontMatter: this.frontMatterBuilder.build(built) };

    const theme = getTheme(request.themeName);
    const styled = this.themeEngine.applyTheme(book, theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, request.pageLayout);

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
