import type { BookDTO } from './BookDTO';
import type { ImportReportDTO } from './ImportReportDTO';

export interface ImportResponseDTO {
  book: BookDTO;
  report: ImportReportDTO;
  /**
   * The project this import created (additive, Sprint 9 detour). Present only when the import
   * succeeded — a rejected import creates no project, so there is no id to return. Optional
   * rather than nullable for exactly that reason: absence IS the "no project" signal.
   */
  projectId?: string;
}
