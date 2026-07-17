import type { StyledBook } from './Theme';
import type { PageLayout } from './PageLayout';

export interface Page {
  number: number;
  blocks: string[];
  // Sprint 6: the title text a running head should show for this page, resolved from
  // Theme.runningHead.content during pagination - LayoutEngine is the only place that knows
  // which chapter/section "owns" a given page, the same content-walking it already does for
  // pagination itself. undefined when Theme.runningHead is absent or show:false. Formatting
  // (uppercase, separator, page-number display, font/size/position) is deliberately NOT
  // resolved here - PDFRenderer/DOCXRenderer already read Theme directly (fonts, colors), so
  // they read Theme.runningHead directly too (commits 6/7), keeping this field to only the
  // one piece only LayoutEngine can compute.
  headerFooterTitle?: string;
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
