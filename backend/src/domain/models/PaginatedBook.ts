import type { StyledBook } from './Theme';
import type { PageLayout } from './PageLayout';

export interface Page {
  number: number;
  blocks: string[];
}

export interface PaginatedBook {
  styledBook: StyledBook;
  pages: Page[];
  // Sprint 6 (Professional Layout Engine): the PageLayout paginate() actually computed pages
  // against - always populated by LayoutEngine.paginate(), which already receives a `layout`
  // parameter but previously discarded it after using it for pagination math. Without this,
  // PDFRenderer/DOCXRenderer had no way to render at anything but their own hardcoded
  // Letter-equivalent geometry, regardless of which PageLayout the caller selected - a real gap
  // found while wiring RunningHead/header-footer support, fixed as a direct prerequisite (same
  // precedent as ADR-0023/ADR-0026: found and fixed, not filed separately).
  pageLayout: PageLayout;
}
