import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { ValidationEngine } from '../../domain/services/ValidationEngine';
import type { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
import type { Book, ValidationReport, ValidationIssue, QualityScore } from '../../domain/models/Book';
import type { BookMapper } from '../mappers/BookMapper';
import type { ImportRequest } from './types';
import type { ImportResponseDTO } from '../dto/ImportResponseDTO';
import type { ImportReportDTO } from '../dto/ImportReportDTO';
import type { ValidationIssueDTO } from '../dto/ValidationIssueDTO';
import type { QualityScoreDTO } from '../dto/QualityScoreDTO';

function toIssueDTO(issue: ValidationIssue): ValidationIssueDTO {
  return {
    code: issue.code,
    message: issue.message,
    location: issue.location,
    severity: issue.severity,
    suggestion: issue.suggestion,
  };
}

function toScoreDTO(score: QualityScore): QualityScoreDTO {
  return { overall: score.overall, categories: { ...score.categories } };
}

export class ImportManuscriptUseCase implements UseCase<ImportRequest, ImportResponseDTO> {
  constructor(
    private parser: DocumentParser,
    private normalizer: DocumentNormalizer,
    private builder: ASTBuilder,
    private validator: ValidationEngine,
    private metrics: BookMetricsCalculator,
    private mapper: BookMapper
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

    return { book: bookDTO, report };
  }

  private buildReport(book: Book, validation: ValidationReport): ImportReportDTO {
    const { chapters, images, tables } = this.metrics.countContent(book);

    return {
      status: validation.isValid ? 'success' : 'error',
      statistics: { chapters, images, tables, words: book.wordCount ?? 0 },
      warnings: validation.warnings.map((warning) => warning.message),
      errors: validation.errors.map((error) => error.message),
      issues: validation.issues.map(toIssueDTO),
      score: toScoreDTO(validation.score),
    };
  }
}
