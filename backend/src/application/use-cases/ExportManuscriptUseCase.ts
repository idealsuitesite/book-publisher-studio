import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { Renderer } from '../../domain/ports/Renderer';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { ThemeEngine } from '../../domain/services/ThemeEngine';
import type { TypographyResolver } from '../../domain/services/TypographyResolver';
import type { LayoutEngine } from '../../domain/services/LayoutEngine';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import type { PageLayout } from '../../domain/models/PageLayout';
import type { Book } from '../../domain/models/Book';
import { getTheme } from '../../domain/themes/getTheme';

export interface ExportRequest {
  buffer: Buffer;
  filename: string;
  themeName: string;
  pageLayout: PageLayout;
}

export class ExportManuscriptUseCase implements UseCase<ExportRequest, Buffer> {
  constructor(
    private parser: DocumentParser,
    private normalizer: DocumentNormalizer,
    private builder: ASTBuilder,
    private themeEngine: ThemeEngine,
    private typographyResolver: TypographyResolver,
    private layoutEngine: LayoutEngine,
    private renderer: Renderer<Buffer>,
    private frontMatterBuilder: FrontMatterBuilder = new FrontMatterBuilder()
  ) {}

  async execute(request: ExportRequest): Promise<Buffer> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const built = this.builder.build(normalized);
    return this.renderBook(built, request.themeName, request.pageLayout);
  }

  /**
   * Renders an already-built `Book` through the theme -> typography -> layout -> renderer tail.
   *
   * Two entry points share this: `execute()` above, which parses raw upload bytes, and the
   * project export path (`ExportProjectUseCase`), which passes the project's STORED book so a
   * manual structure edit (reorder/rename) actually reaches the output. Before this existed the
   * project path re-parsed the original source bytes and silently discarded every stored edit -
   * the manuscript in the Structure station and the manuscript in the export were two different
   * books (STRUCTURE_EDITING.md §5/§9; the defect is logged in DECISIONS.md and TODO.md).
   *
   * Front matter is still synthesised here, exactly as before, so output is unchanged for an
   * unedited book. Moving it to import time is Q3's separate commit; this commit only changes
   * *which* book gets rendered.
   */
  async renderBook(source: Book, themeName: string, pageLayout: PageLayout): Promise<Buffer> {
    const book = { ...source, frontMatter: this.frontMatterBuilder.build(source) };

    const theme = getTheme(themeName);
    const styled = this.themeEngine.applyTheme(book, theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, pageLayout);

    // Metrics are discarded here on purpose: the export path has no validator to feed, and an
    // unused field is what the handbook's port-vs-class rule exists to prevent (ADR-0045).
    return (await this.renderer.render(paginated, { language: book.metadata.language })).output;
  }
}
