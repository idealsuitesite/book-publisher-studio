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

    // ASTBuilder sets `frontMatter: {}` on every import, so until now every exported book
    // opened directly on Chapter 1 - no title page, no copyright page, no ISBN. Generated here
    // rather than inside ASTBuilder because it is a presentation decision about the finished
    // book, not a fact recovered from the source document; the import path (which feeds the
    // structure view and validation) is deliberately left untouched.
    const book = { ...built, frontMatter: this.frontMatterBuilder.build(built) };

    const theme = getTheme(request.themeName);
    const styled = this.themeEngine.applyTheme(book, theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, request.pageLayout);

    return this.renderer.render(paginated, { language: book.metadata.language });
  }
}
