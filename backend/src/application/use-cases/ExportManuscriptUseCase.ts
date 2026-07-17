import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { Renderer } from '../../domain/ports/Renderer';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { ThemeEngine } from '../../domain/services/ThemeEngine';
import type { TypographyResolver } from '../../domain/services/TypographyResolver';
import type { LayoutEngine } from '../../domain/services/LayoutEngine';
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
    private renderer: Renderer<Buffer>
  ) {}

  async execute(request: ExportRequest): Promise<Buffer> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const book = this.builder.build(normalized);

    const theme = getTheme(request.themeName);
    const styled = this.themeEngine.applyTheme(book, theme);
    const typeset = this.typographyResolver.resolve(styled);
    const paginated = this.layoutEngine.paginate(typeset, request.pageLayout);

    return this.renderer.render(paginated, { language: book.metadata.language });
  }
}
