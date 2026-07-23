/**
 * Canonical TypeScript type/DTO definitions shared between `backend/` and
 * `frontend/`. Interfaces, types, enums only — no business logic, no
 * validation rules, no runtime behavior (see this package's own README.md
 * and ADR-0033). `ManuscriptOptionsDTO` was the first export here (Sprint 7
 * commit 2, Decision 5); the pre-existing backend DTOs below moved here in
 * commit 3, unchanged in shape - `backend/src/application/dto/*.ts` are now
 * thin re-export shims so every existing consumer keeps working unmodified.
 */
export type { ThemeOptionDTO, LayoutOptionDTO, ManuscriptOptionsDTO } from './ManuscriptOptionsDTO';

export type { InlineDTO } from './InlineDTO';
export type {
  BlockDTO,
  HeadingDTO,
  ParagraphDTO,
  QuoteDTO,
  ScriptureDTO,
  ImageDTO,
  TableDTO,
  ListDTO,
  FootnoteDTO,
} from './BlockDTO';
export type { SectionDTO } from './SectionDTO';
export type { ChapterDTO } from './ChapterDTO';
export type { FrontMatterDTO, TitlePageDTO, CopyrightPageDTO } from './FrontMatterDTO';
export type { MetadataDTO } from './MetadataDTO';
export type { BookDTO, ContentDTO } from './BookDTO';
export type { ValidationIssueDTO } from './ValidationIssueDTO';
export type { QualityScoreDTO } from './QualityScoreDTO';
export type { ImportReportDTO } from './ImportReportDTO';
export type { ImportResponseDTO } from './ImportResponseDTO';
export type { PublishingIssueDTO, PublishingResponseDTO } from './PublishingResponseDTO';
export type { ProjectSummaryDTO, ProjectListResponseDTO } from './ProjectSummaryDTO';
export type { ProjectDTO, ProjectVersionDTO, ProjectPublicationDTO, ProjectSettingsDTO, UpdateProjectSettingsDTO, TypographyOverrideDTO } from './ProjectDTO';
export type { ApiErrorCode, ApiErrorDTO } from './ApiErrorDTO';
export type { StructureMutation } from './StructureMutation';
export type { StructureSuggestionDTO, StructureSuggestionsResponseDTO } from './StructureSuggestionDTO';
export type { CleanupSuggestionDTO, CleanupSuggestionsResponseDTO } from './CleanupSuggestionDTO';
