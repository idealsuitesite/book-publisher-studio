import type { StyledBook } from './Theme';
import type { PageLayout } from './PageLayout';
import type { TOCEntry } from './Book';

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
  // Sprint 6: number of blank pages Chapter.openingPageStyle requires immediately before this
  // page's first block (e.g. an odd running page count when a chapter needs 'right'). Blank
  // pages never get their own Page entry (no content, no meaningful running head/footer) -
  // renderers insert this many extra page breaks right before breaking to this page's first
  // block. undefined/0 means no blank page is needed here.
  blankPagesBefore?: number;
  /**
   * Phase B (LAYOUT_FIDELITY.md Decision 7): this page's LAST block is split — only its first
   * `splitAfterLines` lines render here; the rest continues on the next page. Always ≥2, and
   * the remainder is always ≥2 as well: min-two-lines at both ends of a break IS widow/orphan
   * control, not a feature on top of it.
   */
  splitAfterLines?: number;
  /**
   * This page's FIRST block continues a block split on the previous page. Renderers must not
   * force a page break for it — the split rendering itself produces the break — and DOCX must
   * not insert one at all (Word reflows; the whole paragraph lives at its start).
   */
  startsWithContinuation?: boolean;
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
  // Sprint 6 (Functional Spec item 7): automatically generated from Heading blocks, only when
  // Book.frontMatter.toc?.generateAutomatically is true - undefined otherwise. Book itself is
  // never mutated (ADR-0001), so a manually-authored frontMatter.toc.entries is never touched or
  // overwritten by this - the two live in entirely separate places. A flat, level-annotated list
  // in document order, not a nested tree: TOCEntry.children is always left undefined here -
  // nesting rules (which headings are "children" of which) aren't specified anywhere in the
  // design and would need their own decision; deferred rather than guessed (same restraint as
  // ADR-0029 Risk 5).
  tableOfContents?: TOCEntry[];
}
