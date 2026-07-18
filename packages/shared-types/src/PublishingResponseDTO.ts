/**
 * POST /api/manuscripts/publish response shape (Sprint 8, PUBLISHING_ENGINE.md Decision 4).
 * Deliberately generic - named PublishingResponseDTO, not KDPPublishingResponse, per the CTO's
 * explicit Commit 6 requirement: when Kobo/Lulu/IngramSpark arrive, this contract doesn't
 * change, only `target`'s real value does. Mirrors the Domain PublishingReport's shape exactly
 * (Dates as ISO strings, matching MetadataDTO.publicationDate's existing convention).
 */
export interface PublishingIssueDTO {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface PublishingResponseDTO {
  target: string;
  status: 'PASS' | 'FAIL';
  summary: string;
  issues: PublishingIssueDTO[];
  warnings: string[];
  artifacts: string[];
  generatedAt: string;
  duration: number;
}
