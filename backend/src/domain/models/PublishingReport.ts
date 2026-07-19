import type { RenderMetrics } from './RenderMetrics';

// One rendered artifact: its bytes, and what was measured while producing them.
//
// Metrics are attached per format rather than per bundle (ADR-0042) because a bundle may hold a
// paginated PDF and a reflowable EPUB at once - a single bundle-level page count would
// necessarily be wrong about one of them.
export interface RenderedOutput {
  bytes: Buffer;
  metrics: RenderMetrics;
}

export interface RenderedOutputs {
  pdf?: RenderedOutput;
  epub?: RenderedOutput;
  docx?: RenderedOutput;
}

export interface PublishingIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

// CTO-reinforced shape (Commit 1 follow-up, ADR-0037) - artifacts/generatedAt/duration/summary
// let a future platform enrich the report without breaking this API, matching Decision 8's
// "engine objects are platform-agnostic" rule: nothing below names or assumes any platform.
export interface PublishingReport {
  status: 'PASS' | 'FAIL';
  target: string;
  issues: PublishingIssue[];
  warnings: string[];
  artifacts: string[]; // identifiers/filenames of what was produced, e.g. bundle contents; empty until Commit 2/4 populate it
  generatedAt: Date;
  duration: number; // milliseconds
  summary: string; // one-line human-readable result, e.g. "PASS - 0 errors, 2 warnings"
}
