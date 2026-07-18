/**
 * GET /api/manuscripts/options response shape (Sprint 7 Decision 5).
 * Additive-friendly by construction: each category is its own named array,
 * so a future category (plugins, templates) is a new key, never a change
 * to an existing one - same discipline as StyledBook.blockTypography?/
 * PaginatedBook.pageLayout?/Theme.runningHead? (ADR-0022/0027/0029).
 */
export interface ThemeOptionDTO {
  name: string;
  label: string;
}

export interface LayoutOptionDTO {
  name: string;
  label: string;
  category: 'standard' | 'kdp';
}

export interface ManuscriptOptionsDTO {
  themes: ThemeOptionDTO[];
  layouts: LayoutOptionDTO[];
}
