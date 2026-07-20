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

    // The raw-bytes route (/api/manuscripts/export) has no stored book, so front matter is
    // synthesised HERE, at the boundary — never inside renderBook. Since Q3, the project path
    // populates front matter at import instead and renders stored content untouched; keeping
    // synthesis out of the shared render tail is what lets those two facts coexist.
    const book = { ...built, frontMatter: this.frontMatterBuilder.build(built) };
    return this.renderBook(book, request.themeName, request.pageLayout);
  }

  /**
   * Renders an already-built `Book` through the theme -> typography -> layout -> renderer tail.
   * **Renders the book's front matter exactly as given — no synthesis.**
   *
   * Two entry points share this: `execute()` above (raw upload bytes, front matter synthesised at
   * the boundary before calling in) and the project export path (`ExportProjectUseCase`, which
   * passes the project's STORED book — front matter populated at import, structure edits included).
   * Before the render tail existed, the project path re-parsed the original source bytes and
   * silently discarded every stored edit — the Structure station and the export were two different
   * books (STRUCTURE_EDITING.md §5/§9; ADR-0052).
   */
  async renderBook(book: Book, themeName: string, pageLayout: PageLayout): Promise<Buffer> {
    const theme = getTheme(themeName);
    const styled = this.themeEngine.applyTheme(book, theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, pageLayout);

    // Metrics are discarded here on purpose: the export path has no validator to feed, and an
    // unused field is what the handbook's port-vs-class rule exists to prevent (ADR-0045).
    return (await this.renderer.render(paginated, { language: book.metadata.language })).output;
  }
}
