import type { BookDTO } from './BookDTO';
import type { ImportReportDTO } from './ImportReportDTO';

/**
 * One project, opened in the Workspace (HOME_WORKSPACE.md §0's journey: `GET /api/projects/:id`).
 *
 * Deliberately NOT the aggregate: versions carry no book snapshots and assets carry no bytes —
 * ADR-0046 measured a 50-version aggregate at 45MB, and that must never walk onto the wire.
 * The Workspace needs the current book, the settings, the freshly computed validation, and
 * light history rows; that is exactly what this carries.
 */
export interface ProjectVersionDTO {
  id: string;
  number: number;
  label?: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface ProjectPublicationDTO {
  target: string;
  status: 'PASS' | 'FAIL';
  /** The version number that produced it, when linked. */
  versionNumber?: number;
  /** ISO timestamp. */
  occurredAt: string;
}

export interface ProjectSettingsDTO {
  layoutName: string;
  themeName: string;
  /** Optional per-project accent colour (hex) overriding the theme's accent (MINI_DR_PER_THEME_ACCENT). */
  accentOverride?: string;
}

export interface ProjectDTO {
  id: string;
  name: string;
  book: BookDTO;
  settings: ProjectSettingsDTO;
  /**
   * Validation of the CURRENT stored book, computed on read — never stored, so it can never
   * be stale relative to the manuscript (HOME_WORKSPACE.md journey, Validation station).
   */
  report: ImportReportDTO;
  /** The original upload's filename, when the source was retained. */
  sourceFilename?: string;
  versions: ProjectVersionDTO[];
  publications: ProjectPublicationDTO[];
  /** ISO timestamp. */
  updatedAt: string;
}

export interface UpdateProjectSettingsDTO {
  layoutName?: string;
  themeName?: string;
  /**
   * Set (a hex string) or CLEAR (null or '') the per-project accent override. Omitted leaves it
   * unchanged (MINI_DR_PER_THEME_ACCENT).
   */
  accentOverride?: string | null;
}
