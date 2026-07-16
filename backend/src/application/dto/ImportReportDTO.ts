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
}
