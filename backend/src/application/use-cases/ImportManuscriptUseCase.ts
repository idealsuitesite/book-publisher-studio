import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { ValidationEngine } from '../../domain/services/ValidationEngine';
import type { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
import type { Book, ValidationReport } from '../../domain/models/Book';
import type { BookMapper } from '../mappers/BookMapper';
import type { ImportRequest } from './types';
import type { ImportResponseDTO } from '../dto/ImportResponseDTO';
import { buildImportReport } from '../mappers/ImportReportMapper';
import type { ProjectService } from '../../domain/services/ProjectService';
import type { ProjectRepository } from '../../domain/ports/ProjectRepository';

export class ImportManuscriptUseCase implements UseCase<ImportRequest, ImportResponseDTO> {
  constructor(
    private parser: DocumentParser,
    private normalizer: DocumentNormalizer,
    private builder: ASTBuilder,
    private validator: ValidationEngine,
    private metrics: BookMetricsCalculator,
    private mapper: BookMapper,
    // Optional so existing construction sites and tests keep working; app.ts wires the real
    // ones. Both or neither: a service without a repository could create projects nobody can
    // ever find again.
    private projectService?: ProjectService,
    private projectRepository?: ProjectRepository
  ) {}

  async execute(request: ImportRequest): Promise<ImportResponseDTO> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const book = this.builder.build(normalized);
    // No PaginatedBook exists on the import path (that's only produced by
    // ExportManuscriptUseCase's ThemeEngine -> TypographyResolver ->
    // LayoutEngine chain) - ValidationContext.metrics is therefore omitted
    // here, not guessed at. TypographyRule already handles an absent
    // `metrics` by returning no issues (docs/architecture/diagrams/
    // VALIDATION_ENGINE.md); every other rule only needs `book`. Wiring
    // ValidationContext.metrics into the export path is explicitly out of
    // Sprint 5 scope (VALIDATION_ENGINE.md §6).
    const validation = this.validator.validate({ book });
    const enrichedBook = this.metrics.calculate(book);
    const bookDTO = this.mapper.map(enrichedBook);
    const report = this.buildReport(enrichedBook, validation);

    // A successful import IS the creation of a project (PRODUCT_OBJECT_MODEL.md - the project
    // is the unit of work; the book is content). The original upload is retained as a 'source'
    // asset because import is lossy today (AGGREGATES_AND_PERSISTENCE.md Question 5).
    //
    // A REJECTED import creates no project, deliberately: the UI treats 422 as "fix your file
    // and try again", and a library that silently accumulates a project per failed attempt
    // would fill with orphans the author never asked to keep. If that judgment turns out wrong
    // for real authors, the change is confined to this one block.
    let projectId: string | undefined;
    if (report.status === 'success' && this.projectService && this.projectRepository) {
      let project = this.projectService.create(enrichedBook, {
        layoutName: 'letter',
        themeName: 'classic',
      });
      project = this.projectService.attachSource(
        project,
        request.filename,
        request.mimeType,
        request.buffer
      );
      await this.projectRepository.save(project);
      projectId = project.id;
    }

    return { book: bookDTO, report, projectId };
  }

  private buildReport(book: Book, validation: ValidationReport) {
    // Extracted to ImportReportMapper the day GetProjectUseCase became its second consumer -
    // the Workspace's Validation station must show the SAME report shape import showed.
    return buildImportReport(book, validation, this.metrics);
  }
}
