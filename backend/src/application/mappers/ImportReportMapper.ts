import type { Book, ValidationReport, ValidationIssue, QualityScore } from '../../domain/models/Book';
import type { NormalizationDiagnostic } from '../../domain/models/Normalized';
import type { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
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

/**
 * ValidationReport → ImportReportDTO, extracted from `ImportManuscriptUseCase` (where it was
 * private) the day a second real consumer appeared: `GetProjectUseCase` computes validation on
 * read for the Workspace's Validation station (HOME_WORKSPACE.md §0), and the report it shows
 * must be the SAME shape import showed — two builders would drift.
 */
export function buildImportReport(
  book: Book,
  validation: ValidationReport,
  metrics: BookMetricsCalculator,
  // Import-time only (ADR-0049): normalization drops are not represented in the Book AST, so
  // GetProjectUseCase's re-validation on read cannot rediscover them and passes nothing here.
  normalizationDiagnostics: NormalizationDiagnostic[] = []
): ImportReportDTO {
  const { chapters, images, tables } = metrics.countContent(book);

  const normalizationIssues: ValidationIssueDTO[] = normalizationDiagnostics.map((d) => ({
    code: d.code,
    message: d.message,
    location: 'structure',
    severity: 'WARNING',
  }));

  return {
    status: validation.isValid ? 'success' : 'error',
    statistics: { chapters, images, tables, words: book.wordCount ?? 0 },
    warnings: [
      ...validation.warnings.map((warning) => warning.message),
      ...normalizationDiagnostics.map((d) => d.message),
    ],
    errors: validation.errors.map((error) => error.message),
    issues: [...validation.issues.map(toIssueDTO), ...normalizationIssues],
    score: toScoreDTO(validation.score),
  };
}
