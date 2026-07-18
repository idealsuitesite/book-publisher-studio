export interface ValidationIssueDTO {
  code: string;
  message: string;
  location: string;
  severity: 'ERROR' | 'WARNING' | 'INFO' | 'SUGGESTION';
  suggestion?: string;
}
