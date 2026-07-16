import type { UseCase } from '../contracts/UseCase';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';
import type { ASTBuilder } from '../../domain/services/ASTBuilder';
import type { BookValidator } from '../../domain/services/BookValidator';
import type { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
import type { Book, ValidationResult } from '../../domain/models/Book';
import type { BookMapper } from '../mappers/BookMapper';
import type { ImportRequest } from './types';
import type { ImportResponseDTO } from '../dto/ImportResponseDTO';
import type { ImportReportDTO } from '../dto/ImportReportDTO';

export class ImportManuscriptUseCase implements UseCase<ImportRequest, ImportResponseDTO> {
  constructor(
    private parser: DocumentParser,
    private normalizer: DocumentNormalizer,
    private builder: ASTBuilder,
    private validator: BookValidator,
    private metrics: BookMetricsCalculator,
    private mapper: BookMapper
  ) {}

  async execute(request: ImportRequest): Promise<ImportResponseDTO> {
    const raw = await this.parser.parse(request.buffer);
    const normalized = this.normalizer.normalize(raw.html, { fileName: request.filename });
    const book = this.builder.build(normalized);
    const validation = this.validator.validate(book);
    const enrichedBook = this.metrics.calculate(book);
    const bookDTO = this.mapper.map(enrichedBook);
    const report = this.buildReport(enrichedBook, validation);

    return { book: bookDTO, report };
  }

  private buildReport(book: Book, validation: ValidationResult): ImportReportDTO {
    const { chapters, images, tables } = this.metrics.countContent(book);

    return {
      status: validation.isValid ? 'success' : 'error',
      statistics: { chapters, images, tables, words: book.wordCount ?? 0 },
      warnings: validation.warnings.map((warning) => warning.message),
      errors: validation.errors.map((error) => error.message),
    };
  }
}
