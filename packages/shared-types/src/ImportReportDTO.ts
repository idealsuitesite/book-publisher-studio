import type { ValidationIssueDTO } from './ValidationIssueDTO';
import type { QualityScoreDTO } from './QualityScoreDTO';

export interface ImportReportDTO {
  status: 'success' | 'error';
  statistics: {
    chapters: number;
    images: number;
    tables: number;
    words: number;
  };
  warnings: string[];
  errors: string[];
  // Additive (Sprint 5, Validation Engine) - issues/score give a fuller,
  // structured view over the same findings warnings/errors already
  // summarize as strings. warnings/errors are kept unchanged for existing
  // consumers.
  issues: ValidationIssueDTO[];
  score: QualityScoreDTO;
}
