import type { BookDTO } from './BookDTO';
import type { ImportReportDTO } from './ImportReportDTO';
import type { EditorialSkeletonDTO } from './EditorialSkeletonDTO';

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
  /** Optional per-project typography override (MINI_DR_TYPOGRAPHY_TUNING). */
  typographyOverride?: TypographyOverrideDTO;
}

/**
 * Per-project typography tuning (MINI_DR_TYPOGRAPHY_TUNING, the four CTO-locked decisions).
 * `preset` is stored by NAME and resolved as an OFFSET from the theme's own default body
 * (compact −1 / standard 0 / comfort +1 / large +2 pt — numerically 10/11/12/13 for every
 * current theme), so "standard" always means the theme's designed default. Fonts are logical
 * ROLES resolved against the registry's real families (serif → Georgia/Gelasio, sans →
 * Helvetica/Inter) — a pairing, never a font browser.
 */
export interface TypographyOverrideDTO {
  preset?: 'compact' | 'standard' | 'comfort' | 'large';
  bodyFont?: 'serif' | 'sans';
  headingFont?: 'serif' | 'sans';
}

export interface ProjectDTO {
  id: string;
  name: string;
  book: BookDTO;
  /**
   * The editorial skeleton (AUTHOR_EXPERIENCE_DR §3 D1) — the projected read model of `book`,
   * computed once in the Domain and carried here so the workspace renders one always-coherent spine.
   */
  skeleton: EditorialSkeletonDTO;
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
  /** Set (an object) or CLEAR (null) the per-project typography override. Omitted leaves it
   * unchanged (MINI_DR_TYPOGRAPHY_TUNING). */
  typographyOverride?: TypographyOverrideDTO | null;
}
