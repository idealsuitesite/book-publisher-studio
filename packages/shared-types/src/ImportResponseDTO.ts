import type { BookDTO } from './BookDTO';
import type { ImportReportDTO } from './ImportReportDTO';

export interface ImportResponseDTO {
  book: BookDTO;
  report: ImportReportDTO;
}
