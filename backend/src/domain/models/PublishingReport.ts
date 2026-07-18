export interface RenderedOutputs {
  pdf?: Buffer;
  epub?: Buffer;
  docx?: Buffer;
}

export interface PublishingIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface PublishingReport {
  status: 'PASS' | 'FAIL';
  target: string;
  issues: PublishingIssue[];
  warnings: string[];
}
