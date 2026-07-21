import type { Page } from '../models/PaginatedBook';
import type { TOCEntry } from '../models/Book';

/**
 * The accent-invariant pagination geometry a colour-only refresh can reuse
 * (MINI_DR_PAGINATION_REUSE). Deliberately NOT the `StyledBook`/`TypesetBook`: those carry the
 * accent colour (`ThemeEngine` bakes `colors.accent` into block styles, and `PDFRenderer` reads
 * it for the title), so caching them would silently serve the OLD colour on a hit — the §3 trap.
 * `Page[]` carries only geometry (block-ids, page assignment, line-splits, running-head titles),
 * so it is safe to reuse while rebuilding the cheap colour-carrying tail fresh each hit.
 */
export interface PaginationGeometry {
  pages: Page[];
  tableOfContents?: TOCEntry[];
}

/**
 * A cache of pagination geometry keyed on the geometry-affecting inputs ONLY
 * (book content, theme, layout — never the accent). A port, not a concrete class, because a
 * future multi-process/distributed deployment could legitimately back this with a shared store
 * (e.g. Redis) — kept open at no cost today (CTO decision, MINI_DR_PAGINATION_REUSE §7 Q1).
 */
export interface PaginationCache {
  get(key: string): PaginationGeometry | undefined;
  set(key: string, geometry: PaginationGeometry): void;
}
